import path from "path";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { filterDuplicate } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import { createExcelWorkbook, getExcelSheetData } from "../libs/helpers/excelHelper";
import ExcelModel from "../models/ExcelModel";
import slugify from "slugify";

export const getAllExcels = async (req: Request, res: Response) => {
  try {
    const excels = await ExcelModel.find().select("name type");

    const message = excels.length > 0 ? `Task found` : `No task found`;

    return responseHelper.returnOkResponse(message, res, excels);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const compareExcel = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const { targetColumn, selectedExcel } = req.body;

  try {
    const mainFileBufferOrPath =
      files?.mainFile?.[0].buffer ??
      path.join(__dirname, "../../public/combines", req.body.mainFile.path);
    const mainFilename = files?.mainFile?.[0].originalname ?? req.body.mainFile.filename;
    const startRowIndex = files?.mainFile ? selectedExcel.startRowIndex : 2;

    const mainFileSheet = await getExcelSheetData(
      mainFileBufferOrPath,
      selectedExcel.columns,
      startRowIndex
    );

    const duplicateRows: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] =
      [];

    const mainFileDuplicate = filterDuplicate(
      mainFileSheet.map((row) => row[selectedExcel.primaryColumn]),
      startRowIndex
    );

    if (mainFileDuplicate.length > 0) {
      duplicateRows.push({ filename: mainFilename, rows: mainFileDuplicate });
    }

    const productMap = new Map<string, { value: string; rowNumber: string }>();

    mainFileSheet.forEach((row: any, index) => {
      const productKey = row[selectedExcel.primaryColumn];
      const value = row[targetColumn];
      const rowNumber = index + startRowIndex;
      productMap.set(productKey, { value, rowNumber });
    });

    const secondaryFiles = files?.secondaryFiles ?? req.body.secondaryFiles;

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const fileBufferOrPath =
          file?.buffer ?? path.join(__dirname, "../../public/combines", file.path);
        const filename = file?.originalname ?? file.filename;

        const fileSheet = await getExcelSheetData(
          fileBufferOrPath,
          selectedExcel.columns,
          startRowIndex
        );

        const fileDuplicate = filterDuplicate(
          fileSheet.map((data) => data[selectedExcel.primaryColumn]),
          startRowIndex
        );

        if (fileDuplicate.length > 0) {
          duplicateRows.push({ filename, rows: fileDuplicate });
        }

        const rows = fileSheet
          .map((row: any) => {
            const productKey = row[selectedExcel.primaryColumn];
            const product = productMap.get(productKey);
            const comparisonValue = row[targetColumn];

            if (!product || product.value === undefined) {
              return null;
            }

            const difference = Number(comparisonValue) - Number(product.value);
            const differencePercentage = (difference / Number(product.value)) * 100;

            const item: any = {
              ...row,
              sebelumnya: product.value,
              selisih: difference,
              persentase: differencePercentage,
            };

            return item;
          })
          .filter((row) => row && row.selisih !== 0);

        return { filename: filename, rows };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: selectedExcel,
      columns: selectedExcel.columnLabels,
      results: comparisonResults,
      duplicated: duplicateRows,
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
  const selectedExcel = req.body.selectedExcel; // This one from request validation middleware

  try {
    const mainFileBufferOrPath =
      files?.mainFile?.[0].buffer ??
      path.join(__dirname, "../../public/combines", req.body.mainFile.path);
    const mainFilename = files?.mainFile?.[0].originalname ?? req.body.mainFile.filename;
    const startRowIndex = files?.mainFile ? selectedExcel.startRowIndex : 2;

    const mainSheet = await getExcelSheetData(
      mainFileBufferOrPath,
      selectedExcel.columns,
      startRowIndex
    );

    const duplicateRows: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] =
      [];

    const mainFileDuplicate = filterDuplicate(
      mainSheet.map((row) => row[selectedExcel.primaryColumn]),
      startRowIndex
    );

    if (mainFileDuplicate.length > 0) {
      duplicateRows.push({ filename: mainFilename, rows: mainFileDuplicate });
    }

    const secondaryFiles = files?.secondaryFiles ?? req.body.secondaryFiles;

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const fileBufferOrPath =
          file?.buffer ?? path.join(__dirname, "../../public/combines", file.path);
        const filename = file?.originalname ?? file.filename;

        const fileSheet = await getExcelSheetData(
          fileBufferOrPath,
          selectedExcel.columns,
          startRowIndex
        );

        const skuMap = new Set(fileSheet.map((row) => row.sku_produk));

        const fileDuplicate = filterDuplicate(
          fileSheet.map((data) => data.sku_produk),
          startRowIndex
        );

        if (fileDuplicate.length > 0) {
          duplicateRows.push({ filename, rows: fileDuplicate });
        }

        const missingSku = mainSheet.filter((row: any) => !skuMap.has(row.sku_produk));

        return { filename, rows: missingSku };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: selectedExcel,
      results: comparisonResults,
      duplicated: duplicateRows,
    });
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const findActualPrice = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;

  try {
    const selectedExcel = await ExcelModel.findOne({ type: "shopee_product" });

    const mainFileBufferOrPath = files.mainFile[0].buffer;
    const mainFilename = files.mainFile[0].originalname;

    const discountFileBufferOrPath = files.discountFile[0].buffer;
    const discountFileColumns = [
      { key: "kode_produk", label: "Kode Produk" },
      { key: "nama_produk", label: "Nama Produk" },
      { key: "sku_induk", label: "Sku Induk" },
      { key: "kode_variasi", label: "Kode Variasi" },
      { key: "nama_variasi", label: "Nama Variasi" },
      { key: "sku_produk", label: "Sku Produk" },
      { key: "harga", label: "Harga" },
      { key: "harga_diskon", label: "Harga Diskon" },
    ];

    const [mainSheet, discountSheet] = await Promise.all([
      getExcelSheetData(mainFileBufferOrPath, selectedExcel!.columns, selectedExcel!.startRowIndex),
      getExcelSheetData(discountFileBufferOrPath, discountFileColumns, 2),
    ]);

    const productMap = new Map<string, any>();

    mainSheet.forEach((row) => {
      const productKey = row[selectedExcel!.primaryColumn];
      if (productMap.has(productKey)) return;
      productMap.set(productKey, row);
    });

    discountSheet.forEach((row) => {
      const productKey = row[selectedExcel!.primaryColumn];

      if (!productMap.has(productKey)) return;
      const product = productMap.get(productKey);
      productMap.set(productKey, { ...product, harga: row.harga_diskon });
    });

    if (files.customFile) {
      const customFileBufferOrPath = files.customFile[0].buffer;
      const customFileColumns = [
        { key: "sku_produk", label: "SKU Produk" },
        { key: "harga_khusus", label: "Harga Khusus" },
      ];

      const customSheet = await getExcelSheetData(customFileBufferOrPath, customFileColumns, 2);

      customSheet.forEach((row) => {
        const productKey = row[selectedExcel!.primaryColumn];

        if (!productMap.has(productKey)) return;
        const product = productMap.get(productKey);
        productMap.set(productKey, { ...product, harga: row.harga_khusus });
      });
    }

    const updatedRows = Array.from(productMap, ([key, value]) => value);

    const outputFilename = mainFilename.substring(0, mainFilename.length - 5);
    const outputFilenameSlug = slugify(outputFilename, {
      replacement: "_",
      lower: true,
    });

    const uniqueId = new mongoose.Types.ObjectId();
    const updatedFilePath = `${outputFilenameSlug}_${uniqueId}.xlsx`;

    const updatedFileWorkbook = createExcelWorkbook(selectedExcel!.columns, updatedRows);
    updatedFileWorkbook.xlsx.writeFile(
      path.join(__dirname, "../../public/combines", updatedFilePath)
    );

    return responseHelper.returnOkResponse("Combine successful", res, {
      filename: outputFilename,
      path: updatedFilePath,
    });
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
