import mongoose from "mongoose";
import { Request, Response } from "express";
import { filterDuplicate } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import { createExcelWorkbook, getExcelSheetData } from "../libs/helpers/excelHelper";
import ExcelModel from "../models/ExcelModel";

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
  const { mainFile, secondaryFiles } = req.files as Record<string, Express.Multer.File[]>;

  try {
    const mainSheet = await getExcelSheetData(
      mainFile[0].buffer,
      "Sheet1",
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

    const productMap = new Map(
      mainSheet.map((row, index) => [
        row[selectedExcel.primaryColumn],
        { value: row[targetColumn], rowNumber: index + selectedExcel.startRowIndex },
      ])
    );

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const { originalname, buffer } = file;

        const comparisonSheet = await getExcelSheetData(
          buffer,
          "Sheet1",
          selectedExcel.columns,
          selectedExcel.startRowIndex
        );

        const comparisonDuplicates = filterDuplicate(
          comparisonSheet.map((data) => data[selectedExcel.primaryColumn]),
          selectedExcel.startRowIndex
        );

        if (comparisonDuplicates.length > 0) {
          duplicatedRows.push({ filename: originalname, rows: comparisonDuplicates });
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
          .filter(Boolean);
        return { filename: originalname, rows };
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
      "Sheet1",
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
        const skuMap = new Set();

        const sheet = await getExcelSheetData(
          file.buffer,
          "Sheet1",
          selectedExcel.columns,
          selectedExcel.startRowIndex
        );

        sheet.forEach((row) => {
          skuMap.add(row.sku_produk);
        });

        const comparisonDuplicates = filterDuplicate(
          sheet.map((data) => data.sku_produk),
          selectedExcel.startRowIndex
        );

        if (comparisonDuplicates.length > 0) {
          duplicatedRows.push({ filename: file.originalname, rows: comparisonDuplicates });
        }

        const missingSku = sheet.filter((row: any) => !skuMap.has(row.sku_produk));

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
      "Sheet1",
      selectedExcel!.columns,
      selectedExcel!.startRowIndex
    );

    const discountSheet = await getExcelSheetData(
      discountFile[0].buffer,
      "Sheet1",
      [
        "kode_produk",
        "nama_produk",
        "sku_induk",
        "kode_variasi",
        "nama_variasi",
        "sku_produk",
        "harga",
        "harga_diskon",
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

    const uniqueId = new mongoose.Types.ObjectId();
    const updatedFilePath = `public/downloads/${uniqueId}.xlsx`;
    const updatedFileWorkbook = createExcelWorkbook(selectedExcel!.columnLabels, updatedRows);
    updatedFileWorkbook.xlsx.writeFile(updatedFilePath);

    return responseHelper.returnOkResponse("Comparison successful", res, {
      link: updatedFilePath,
    });
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
