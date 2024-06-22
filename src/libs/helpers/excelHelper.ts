import ExcelJS, { Workbook } from "exceljs";
import { excelDocument } from "../../interfaces/excel";

export const getSheetData = async (file: string | Buffer, columns: { key: string; label: string }[], skipRowCount: number) => {
  let workbook = new ExcelJS.Workbook();

  if (typeof file === "string") {
    await workbook.xlsx.readFile(file);
  } else {
    await workbook.xlsx.load(file);
  }

  const worksheet = workbook.getWorksheet("Sheet1")!;

  const rowTemplate: Record<string, string> = {};

  columns.forEach((column) => {
    rowTemplate[column.key] = "";
  });

  const sheetData: Record<string, any>[] = [];

  worksheet.eachRow((row, index) => {
    if (index < skipRowCount) return;

    const item = { ...rowTemplate };

    row.eachCell((cell, index) => {
      if (!columns[index - 1]) return;
      const columnKey = columns[index - 1].key;
      item[columnKey] = String(cell.value) ?? "";
    });

    sheetData.push(item);
  });

  return sheetData;
};

export const createExcelWorkbook = (columns: { key: string; label: string }[], rows: {}[]): Workbook => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const columnLabels = columns.map((column) => ({ name: column.label, filterButton: true }));

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

export const checkPrimaryColumn = (sheets: { name: string; data: Record<string, any>[] }[], chosenExcel: excelDocument) => {
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
