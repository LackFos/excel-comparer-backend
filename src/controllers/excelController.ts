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
  const { targetColumn, selectedExcel } = req.body;
  const files = req.files as Record<string, Express.Multer.File[]>;
  const mainFile = files?.mainFile || req.body.mainFile;
  const secondaryFiles = files?.secondaryFiles || req.body.secondaryFiles;

  try {
    const mainFilePathOrBuffer = mainFile?.[0]?.buffer ?? req.body.mainFile.path;
    const mainFilename = mainFile?.[0]?.originalname ?? req.body.mainFile.filename;

    const mainSheet = await getExcelSheetData(
      mainFilePathOrBuffer,
      selectedExcel.columns,
      selectedExcel.startRowIndex
    );

    const duplicatedRows: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] =
      [];

    const mainDuplicates = filterDuplicate(
      mainSheet.map((row) => row[selectedExcel.primaryColumn]),
      selectedExcel.startRowIndex
    );

    if (mainDuplicates.length > 0) {
      duplicatedRows.push({ filename: mainFilename, rows: mainDuplicates });
    }

    const productMap = new Map(
      mainSheet.map((row, index) => [
        row[selectedExcel.primaryColumn],
        { value: row[targetColumn], rowNumber: index + selectedExcel.startRowIndex },
      ])
    );

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const secondaryFilePathOrBuffer = file?.buffer ?? file.path;
        const secondaryFilename = file?.originalname ?? file.filename;

        const comparisonSheet = await getExcelSheetData(
          secondaryFilePathOrBuffer,
          selectedExcel.columns,
          selectedExcel.startRowIndex
        );

        const comparisonDuplicates = filterDuplicate(
          comparisonSheet.map((data) => data[selectedExcel.primaryColumn]),
          selectedExcel.startRowIndex
        );

        if (comparisonDuplicates.length > 0) {
          duplicatedRows.push({ filename: secondaryFilename, rows: comparisonDuplicates });
        }

        const rows = comparisonSheet
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
          .filter((row) => row && row.selisih > 0);

        return { filename: secondaryFilename, rows };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: selectedExcel,
      columns: selectedExcel.columnLabels,
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
  const { mainFile, secondaryFiles } = req.files as Record<string, Express.Multer.File[]>;
  const selectedExcel = req.body.selectedExcel;

  try {
    const mainSheet = await getExcelSheetData(
      mainFile[0].buffer,
      selectedExcel.columns,
      selectedExcel.startRowIndex
    );

    const duplicatedRows: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] =
      [];

    const mainDuplicates = filterDuplicate(
      mainSheet.map((row) => row[selectedExcel.primaryColumn]),
      selectedExcel.startRowIndex
    );

    if (mainDuplicates.length > 0) {
      duplicatedRows.push({ filename: mainFile[0].originalname, rows: mainDuplicates });
    }

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const sheet = await getExcelSheetData(
          file.buffer,
          selectedExcel.columns,
          selectedExcel.startRowIndex
        );

        const skuMap = new Set(sheet.map((row) => row.sku_produk));

        const comparisonDuplicates = filterDuplicate(
          sheet.map((data) => data.sku_produk),
          selectedExcel.startRowIndex
        );

        if (comparisonDuplicates.length > 0) {
          duplicatedRows.push({ filename: file.originalname, rows: comparisonDuplicates });
        }

        const missingSku = mainSheet.filter((row: any) => !skuMap.has(row.sku_produk));

        return { filename: file.originalname, rows: missingSku };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: selectedExcel,
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

export const findActualPrice = async (req: Request, res: Response) => {
  const { mainFile, discountFile } = req.files as Record<string, Express.Multer.File[]>;

  try {
    const selectedExcel = await ExcelModel.findOne({ type: "shopee_product" });

    const mainSheet = await getExcelSheetData(
      mainFile[0].buffer,
      selectedExcel!.columns,
      selectedExcel!.startRowIndex
    );

    const discountSheet = await getExcelSheetData(
      discountFile[0].buffer,
      [
        { key: "kode_produk", label: "Kode Produk" },
        { key: "nama_produk", label: "Nama Produk" },
        { key: "sku_induk", label: "Sku Induk" },
        { key: "kode_variasi", label: "Kode Variasi" },
        { key: "nama_variasi", label: "Nama Variasi" },
        { key: "sku_produk", label: "Sku Produk" },
        { key: "harga", label: "Harga" },
        { key: "harga_diskon", label: "Harga Diskon" },
      ],
      2
    );

    const discountedPriceMap = new Map(
      discountSheet.map((row) => [row[selectedExcel!.primaryColumn], row.harga_diskon])
    );

    const updatedRows = mainSheet.map((row) => {
      const discountedPrice = discountedPriceMap.get(row[selectedExcel!.primaryColumn]);
      if (discountedPrice) {
        row.harga = discountedPrice;
      }
      return row;
    });

    const mainFilename = mainFile[0].originalname;
    const outputFilename = mainFilename.substring(0, mainFilename.length - 5);
    const outputFilenameSlug = slugify(outputFilename, {
      replacement: "_",
      lower: true,
    });

    const uniqueId = new mongoose.Types.ObjectId();
    const updatedFilePath = `public/combines/${outputFilenameSlug}_${uniqueId}.xlsx`;
    const updatedFileWorkbook = createExcelWorkbook(selectedExcel!.columns, updatedRows);
    updatedFileWorkbook.xlsx.writeFile(updatedFilePath);

    return responseHelper.returnOkResponse("Comparison successful", res, {
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
