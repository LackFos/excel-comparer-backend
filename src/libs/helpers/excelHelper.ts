import ExcelJS, { Workbook } from "exceljs";
import { excelDocument } from "../../interfaces/excel";

export const getExcelSheetData = async (
  data: string | Buffer,
  sheetName: string,
  columns: string[],
  startRowIndex: number
) => {
  let workbook = new ExcelJS.Workbook();

  if (typeof data === "string") {
    await workbook.xlsx.readFile(data);
  } else {
    await workbook.xlsx.load(data);
  }

  const worksheet = workbook.getWorksheet(sheetName);

  const rowTemplate: Record<string, string> = {};
  columns.forEach((column) => {
    rowTemplate[column] = "";
  });

  const sheetData: Record<string, string>[] = [];

  worksheet?.eachRow((row, rowNumber) => {
    if (rowNumber < startRowIndex) return;

    const rowData = { ...rowTemplate };

    columns.forEach((column) => {
      rowData[column] = "";
    });

    row.eachCell((cell, cellNumber) => {
      if (!columns[cellNumber - 1]) return;
      const columnKey = columns[cellNumber - 1];
      if (columnKey) rowData[columnKey] = cell.value?.toString() ?? "";
    });

    sheetData.push(rowData);
  });

  return sheetData;
};

export const createExcelWorkbook = (columns: string[], rows: {}[]): Workbook => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const columnLabels = columns.map((column) => ({ name: column, filterButton: true }));

  sheet.addTable({
    name: "Table1",
    ref: "A1",
    headerRow: true,
    style: {
      theme: "TableStyleLight8",
      showRowStripes: true,
    },
    columns: columnLabels,
    rows: rows.map((row) => Object.values(row)),
  });

  return workbook;
};

export const checkPrimaryColumn = (
  sheets: { name: string; data: Record<string, any>[] }[],
  chosenExcel: excelDocument
) => {
  sheets.map((sheet) => {
    const primaryKeyMap = new Map();
    const duplicateKeyMap = new Map();

    sheet.data.forEach((row, index) => {
      const key = row[chosenExcel.primaryColumn];
      const rowIndex = index + chosenExcel.startRowIndex;

      if (primaryKeyMap.has(key)) {
        if (!duplicateKeyMap.has(key)) {
          duplicateKeyMap.set(key, [primaryKeyMap.get(key)]);
        }
        duplicateKeyMap.get(key).push(rowIndex);
      } else {
        primaryKeyMap.set(key, rowIndex);
      }
    });

    return { [sheet.name]: "a" };
  });
};
