import { Request, Response } from "express";
import responseHelper from "../libs/helpers/responseHelper";
import { getExcelSheetData, readExcelBuffer } from "../libs/helpers/excelHelper";
import { excelDocument } from "../interfaces/excel";
import { filterDuplicate } from "../libs/utils";

export const compareExcel = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const mainFile = files.mainFile[0];
  const secondaryFiles = files.secondaryFiles;

  const targetColumn = req.body.targetColumn;
  const chosenExcel: excelDocument = req.body.chosenExcel;

  try {
    // 1) Read main file
    const primaryKey = chosenExcel.primaryColumn;
    const mainExcel = await readExcelBuffer(mainFile.buffer);
    const mainSheetData = getExcelSheetData(
      mainExcel,
      "Sheet1",
      chosenExcel.columns,
      chosenExcel.startRowIndex
    );

    // 2) Find duplicated primary column in main file
    const mainDuplicatesMap = filterDuplicate(
      mainSheetData.map((data) => data[primaryKey]),
      chosenExcel.startRowIndex
    );

    // 3) Prepare object to store duplicated rows
    const duplicatedRows = { [mainFile.originalname]: Object.fromEntries(mainDuplicatesMap) };

    // 4) Compare !!!
    const mainDataMap = new Map();

    // Mapping each product will be use in compare later
    mainSheetData.forEach((row, index) => {
      if (!mainDuplicatesMap.has(row[primaryKey])) {
        mainDataMap.set(row[primaryKey], { value: row[targetColumn], rowNumber: index });
      }
    });

    // Compare each secondaryFile on mainFile
    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const filename = file.originalname;
        const excel = await readExcelBuffer(file.buffer);
        const sheetData = getExcelSheetData(
          excel,
          "Sheet1",
          chosenExcel.columns,
          chosenExcel.startRowIndex
        );

        // Find duplicated primary column in secondary file
        const secondaryDuplicatesMap = filterDuplicate(
          sheetData.map((data) => data[primaryKey]),
          chosenExcel.startRowIndex
        );

        duplicatedRows[file.originalname] = Object.fromEntries(secondaryDuplicatesMap);

        // Compare rows in secondary file with main file
        const rows = sheetData
          .map((row: any) => {
            if (!secondaryDuplicatesMap.has(row[primaryKey])) {
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
