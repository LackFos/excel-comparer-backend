import ExcelJS from "exceljs";
import { excelDocument } from "../../interfaces/excel";

export const getExcelSheetData = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: string[],
  startRowIndex: number
) => {
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

export const readExcelBuffer = (buffer: Buffer): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  return workbook.xlsx.load(buffer);
};

export const readExcelFile = (filename: string): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  return workbook.xlsx.readFile(filename);
};

export const createTaskFile = (rows: {}[], filename: string): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const columnLabels = [
    { name: "Kode Produk", filterButton: true },
    { name: "Nama Produk", filterButton: true },
    { name: "Kode Variasi", filterButton: true },
    { name: "Name Variasi", filterButton: true },
    { name: "SKU Induk", filterButton: true },
    { name: "SKU", filterButton: true },
    { name: "Harga", filterButton: true },
    { name: "Stok", filterButton: true },
    { name: "difference", filterButton: true },
    { name: "differencePercent", filterButton: true },
  ];

  // const dataIndexes = new Set([
  //   "kode_produk",
  //   "nama_produk",
  //   "kode_variasi",
  //   "nama_variasi",
  //   "sku_induk",
  //   "sku_produk",
  //   "harga",
  //   "stok",
  // ]);

  sheet.addTable({
    name: "Table1",
    ref: "A1",
    headerRow: true,
    style: {
      theme: "TableStyleLight8",
      showRowStripes: true,
    },
    columns: columnLabels,
    rows: rows.map((row) => {
      // const data = [];

      // for (const [key, value] of Object.entries(row)) {
      //   if (!dataIndexes.has(key)) continue;
      //   data.push(value);
      // }

      // return data;

      return Object.values(row);
    }),
  });

  return workbook.xlsx.writeFile(filename);
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
