import { Request, Response } from "express";
import { filterDuplicate } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import { getExcelSheetData, readExcelBuffer } from "../libs/helpers/excelHelper";

export const compareExcel = async (req: Request, res: Response) => {
  const { targetColumn, chosenExcel } = req.body;
  const { mainFile, secondaryFiles } = req.files as Record<string, Express.Multer.File[]>;

  try {
    const mainExcel = await readExcelBuffer(mainFile[0].buffer);

    const mainSheetData = getExcelSheetData(
      mainExcel,
      "Sheet1",
      chosenExcel.columns,
      chosenExcel.startRowIndex
    );

    const mainDuplicates = filterDuplicate(
      mainSheetData.map((row) => row[chosenExcel.primaryColumn]),
      chosenExcel.startRowIndex
    );

    const duplicatedRows = [{ filename: mainFile[0].originalname, rows: mainDuplicates }];

    const mainProductMap = new Map(
      mainSheetData.map((row, index) => [
        row[chosenExcel.primaryColumn],
        { value: row[targetColumn], rowNumber: index + chosenExcel.startRowIndex },
      ])
    );

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const { originalname, buffer } = file;

        const comparisonExcel = await readExcelBuffer(buffer);

        const comparisonSheetData = getExcelSheetData(
          comparisonExcel,
          "Sheet1",
          chosenExcel.columns,
          chosenExcel.startRowIndex
        );

        const comparisonDuplicates = filterDuplicate(
          comparisonSheetData.map((data) => data[chosenExcel.primaryColumn]),
          chosenExcel.startRowIndex
        );

        duplicatedRows.push({ filename: originalname, rows: comparisonDuplicates });

        const rows = comparisonSheetData
          .map((row: any) => {
            if (
              !comparisonDuplicates.find(
                (duplicated) => duplicated.column === row[chosenExcel.primaryColumn]
              )
            ) {
              const mainData = mainProductMap.get(row[chosenExcel.primaryColumn]);
              if (mainData) {
                const { value: mainValue } = mainData;
                const secondaryValue = row[targetColumn];

                const difference = Number(secondaryValue) - Number(mainValue);
                const differencePercent = (difference / Number(mainValue)) * 100;
                return { ...row, difference, differencePercent };
              }
            }
          })
          .filter(Boolean);
        return { filename: originalname, rows };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      columns: chosenExcel.columnLabels,
      results: comparisonResults,
      duplicated: duplicatedRows.filter((item) => item.rows.length !== 0),
    });
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const findMissingSku = async (req: Request, res: Response) => {
  const { mainFile, secondaryFiles } = req.files as Record<string, Express.Multer.File[]>;

  const { chosenExcel } = req.body;

  try {
    const mainExcel = await readExcelBuffer(mainFile[0].buffer);

    const mainSheetData = getExcelSheetData(
      mainExcel,
      "Sheet1",
      chosenExcel.columns,
      chosenExcel.startRowIndex
    );

    const mainDuplicates = filterDuplicate(
      mainSheetData.map((row) => row.sku_produk),
      chosenExcel.startRowIndex
    );

    const duplicatedRows = [
      {
        filename: mainFile[0].originalname,
        rows: mainDuplicates,
      },
    ];

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const skuMap = new Set();
        const excel = await readExcelBuffer(file.buffer);
        const sheetRows = getExcelSheetData(
          excel,
          "Sheet1",
          chosenExcel.columns,
          chosenExcel.startRowIndex
        );

        sheetRows.forEach((row) => {
          skuMap.add(row.sku_produk);
        });

        const comparisonDuplicates = filterDuplicate(
          sheetRows.map((data) => data.sku_produk),
          chosenExcel.startRowIndex
        );

        duplicatedRows.push({
          filename: file.originalname,
          rows: comparisonDuplicates,
        });

        const missingSku = mainSheetData.filter((row: any) => !skuMap.has(row.sku_produk));

        return { filename: file.originalname, rows: missingSku };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      columns: chosenExcel.columnLabels,
      results: comparisonResults,
      duplicated: duplicatedRows.filter((item) => item.rows.length !== 0),
    });
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
