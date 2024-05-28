import { Request, Response } from "express";
import { filterDuplicate } from "../libs/utils";
import { compareExcelParams, findMissingSkuParams } from "../libs/types";
import responseHelper from "../libs/helpers/responseHelper";
import { getExcelSheetData, readExcelBuffer } from "../libs/helpers/excelHelper";

export const compareExcel = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const mainFile = files.mainFile[0];
  const secondaryFiles = files.secondaryFiles;

  const { targetColumn, chosenExcel }: compareExcelParams = req.body;

  try {
    // 1) Read main file
    const primaryKey = chosenExcel.primaryColumn;
    const mainExcel = await readExcelBuffer(mainFile.buffer);
    const mainSheetRows = getExcelSheetData(
      mainExcel,
      "Sheet1",
      chosenExcel.columns,
      chosenExcel.startRowIndex
    );

    // 2) Find duplicated primary column in main file
    const mainDuplicates = filterDuplicate(
      mainSheetRows.map((row) => row.sku_produk),
      chosenExcel.startRowIndex
    );

    // 3) Prepare object to store duplicated rows
    const duplicatedRows = [
      {
        filename: mainFile.originalname,
        rows: mainDuplicates,
      },
    ];

    // 4) Compare
    const mainDataMap = new Map();

    // Mapping each product will be use in compare later
    mainSheetRows.forEach((row, index) => {
      if (!mainDuplicates.find((duplicated) => duplicated.column === row[primaryKey])) {
        mainDataMap.set(row[primaryKey], { value: row[targetColumn], rowNumber: index });
      }
    });

    // Compare each secondaryFile on mainFile
    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const filename = file.originalname;
        const excel = await readExcelBuffer(file.buffer);
        const sheetRows = getExcelSheetData(
          excel,
          "Sheet1",
          chosenExcel.columns,
          chosenExcel.startRowIndex
        );

        // Find duplicated primary column in secondary file
        const secondaryDuplicates = filterDuplicate(
          sheetRows.map((data) => data.sku_produk),
          chosenExcel.startRowIndex
        );

        duplicatedRows.push({
          filename: file.originalname,
          rows: secondaryDuplicates,
        });

        // Compare rows in secondary file with main file
        const rows = sheetRows
          .map((row: any) => {
            if (!secondaryDuplicates.find((duplicated) => duplicated.column === row[primaryKey])) {
              if (mainDataMap.has(row[primaryKey])) {
                const mainValue = Number(mainDataMap.get(row[primaryKey]).value);
                const secondaryValue = Number(row[targetColumn]);
                const difference = mainValue - secondaryValue;
                const differencePercent = ((mainValue - secondaryValue) / mainValue) * 100;
                return { ...row, difference, differencePercent };
              }
            }
          })
          .filter(Boolean);

        return { filename, rows };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      columns: chosenExcel.columnLabels,
      results: comparisonResults,
      duplicated: duplicatedRows,
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
  const files = req.files as Record<string, Express.Multer.File[]>;
  const mainFile = files.mainFile[0];
  const secondaryFiles = files.secondaryFiles;

  const { chosenExcel }: findMissingSkuParams = req.body;

  try {
    const mainExcel = await readExcelBuffer(mainFile.buffer);
    const mainSheetRows = getExcelSheetData(
      mainExcel,
      "Sheet1",
      chosenExcel.columns,
      chosenExcel.startRowIndex
    );

    const mainDuplicates = filterDuplicate(
      mainSheetRows.map((row) => row.sku_produk),
      chosenExcel.startRowIndex
    );

    const duplicatedRows = [
      {
        filename: mainFile.originalname,
        rows: mainDuplicates,
      },
    ];

    const results = await Promise.all(
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

        const secondaryDuplicates = filterDuplicate(
          sheetRows.map((data) => data.sku_produk),
          chosenExcel.startRowIndex
        );

        duplicatedRows.push({
          filename: file.originalname,
          rows: secondaryDuplicates,
        });

        const missingSku = mainSheetRows.filter((row: any) => !skuMap.has(row.sku_produk));

        return { filename: file.originalname, rows: missingSku };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      columns: chosenExcel.columnLabels,
      results,
      duplicated: duplicatedRows,
    });
  } catch (error) {}
};
