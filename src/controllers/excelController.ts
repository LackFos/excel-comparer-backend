import path from "path";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { filterDuplicate } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import { createExcelWorkbook, getSheetData } from "../libs/helpers/excelHelper";
import ExcelModel from "../models/ExcelModel";
import slugify from "slugify";
import { excelMimetype } from "../libs/const";

export const getAllExcels = async (req: Request, res: Response) => {
  try {
    const excels = await ExcelModel.find().select("name type");

    const message = excels.length > 0 ? `Task found` : `No task found`;

    return responseHelper.returnOkResponse(message, res, excels);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const compareExcel = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const { type, targetColumn } = req.body;

  try {
    // Validation start here
    if (files) {
      if (!files.mainFile || !files.secondaryFiles) {
        return responseHelper.throwBadRequestError("mainFile and secondaryFiles are required", res);
      }

      if (files.mainFile[0].mimetype !== excelMimetype || files.secondaryFiles.some((file) => file.mimetype !== excelMimetype)) {
        return responseHelper.throwBadRequestError("File must be an excel file", res);
      }
    } else {
      if (!req.body.mainFile || !req.body.secondaryFiles) {
        return responseHelper.throwBadRequestError("mainFile and secondaryFiles are required", res);
      }

      if (
        !req.body.mainFile.filename ||
        !req.body.mainFile.path ||
        req.body.secondaryFiles.some((file: { filename: string; path: string }) => !file.filename || !file.path)
      ) {
        return responseHelper.throwBadRequestError("Invalid request body: files", res);
      }
    }

    const excel = await ExcelModel.findOne({ type });

    if (!excel) {
      return responseHelper.throwBadRequestError("Excel type not found", res);
    }

    if (!excel.filterableColumns.find((column) => column === targetColumn)) {
      return responseHelper.throwBadRequestError("Target column doesnt valid for this excel type", res);
    }

    // Logic start here
    const isFileRequest = files ? true : false;

    const skipRowCount = isFileRequest ? excel.startRowIndex : 2;

    const mainFileName = isFileRequest ? files.mainFile[0].originalname : req.body.mainFile.filename;

    const mainSheet = await getSheetData(
      isFileRequest ? files.mainFile[0].buffer : path.join(__dirname, "../../public/combines", req.body.mainFile.path),
      excel.columns,
      skipRowCount
    );

    // Record duplicated product
    const duplicateProduct: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] = [];

    const mainFileDuplicate = filterDuplicate(
      mainSheet.map((row) => row[excel.primaryColumn]),
      skipRowCount
    );

    if (mainFileDuplicate.length > 0) {
      duplicateProduct.push({ filename: mainFileName, rows: mainFileDuplicate });
    }

    // Comparison start here
    const productMap = new Map<string, { value: string }>();

    mainSheet.forEach((row) => {
      const productKey = row[excel.primaryColumn];
      const value = row[targetColumn];
      productMap.set(productKey, { value });
    });

    const secondaryFiles = isFileRequest ? files.secondaryFiles : (req.body.secondaryFiles as Record<string, any>[]);

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const filename = isFileRequest ? (file as Express.Multer.File).originalname : file.filename;

        const fileSheet = await getSheetData(
          isFileRequest ? (file as Express.Multer.File).buffer : path.join(__dirname, "../../public/combines", file.path),
          excel.columns,
          skipRowCount
        );

        const fileDuplicate = filterDuplicate(
          fileSheet.map((data) => data[excel.primaryColumn]),
          skipRowCount
        );

        if (fileDuplicate.length > 0) {
          duplicateProduct.push({ filename, rows: fileDuplicate });
        }

        const rows = fileSheet
          .map((row) => {
            const productKey = row[excel.primaryColumn];
            const product = productMap.get(productKey);
            const comparisonValue = row[targetColumn];

            if (!product) return null;

            const difference = Number(comparisonValue) - Number(product.value);
            const differencePercentage = (difference / Number(product.value)) * 100;

            const item: any = {
              ...row,
              sebelumnya: Number(product.value),
              selisih: difference,
              persentase: differencePercentage,
            };

            return item;
          })
          .filter((row) => row && row.selisih !== 0);

        return { filename, rows };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: excel,
      columns: excel.columns,
      results: comparisonResults,
      duplicated: duplicateProduct,
    });
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const findMissingSku = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const { type } = req.body;

  try {
    // Validation start here
    if (files) {
      if (!files.mainFile || !files.secondaryFiles) {
        return responseHelper.throwBadRequestError("mainFile and secondaryFiles are required", res);
      }

      if (files.mainFile[0].mimetype !== excelMimetype || files.secondaryFiles.some((file) => file.mimetype !== excelMimetype)) {
        return responseHelper.throwBadRequestError("File must be an excel file", res);
      }
    } else {
      if (!req.body.mainFile || !req.body.secondaryFiles) {
        return responseHelper.throwBadRequestError("mainFile and secondaryFiles are required", res);
      }

      if (
        !req.body.mainFile.filename ||
        !req.body.mainFile.path ||
        req.body.secondaryFiles.some((file: { filename: string; path: string }) => !file.filename || !file.path)
      ) {
        return responseHelper.throwBadRequestError("Invalid request body: files", res);
      }
    }

    const excel = await ExcelModel.findOne({ type });

    if (!excel) {
      return responseHelper.throwBadRequestError("Excel type not found", res);
    }

    // Logic start here
    const isFileRequest = files ? true : false;

    const skipRowCount = isFileRequest ? excel.startRowIndex : 2;

    const mainFileName = isFileRequest ? files.mainFile[0].originalname : req.body.mainFile.filename;

    const mainSheet = await getSheetData(
      isFileRequest ? files.mainFile[0].buffer : path.join(__dirname, "../../public/combines", req.body.mainFile.path),
      excel.columns,
      skipRowCount
    );

    const duplicateProduct: { filename: string; rows: { value: string; rowNumbers: number[] }[] }[] = [];

    const mainFileDuplicate = filterDuplicate(
      mainSheet.map((row) => row[excel.primaryColumn]),
      skipRowCount
    );

    if (mainFileDuplicate.length > 0) {
      duplicateProduct.push({ filename: mainFileName, rows: mainFileDuplicate });
    }

    const secondaryFiles = isFileRequest ? files.secondaryFiles : (req.body.secondaryFiles as [Record<string, any>]);

    const comparisonResults = await Promise.all(
      secondaryFiles.map(async (file) => {
        const filename = isFileRequest ? (file as Express.Multer.File).originalname : file.filename;

        const fileSheet = await getSheetData(
          isFileRequest ? (file as Express.Multer.File).buffer : path.join(__dirname, "../../public/combines", file.path),
          excel.columns,
          skipRowCount
        );

        const fileDuplicate = filterDuplicate(
          fileSheet.map((data) => data.sku_produk),
          skipRowCount
        );

        if (fileDuplicate.length > 0) {
          duplicateProduct.push({ filename, rows: fileDuplicate });
        }

        const skuMap = new Set(fileSheet.map((row) => row.sku_produk));

        const missingSku = mainSheet.filter((row: any) => !skuMap.has(row.sku_produk));

        return { filename, rows: missingSku };
      })
    );

    return responseHelper.returnOkResponse("Comparison successful", res, {
      excel: excel,
      results: comparisonResults,
      duplicated: duplicateProduct,
    });
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const findActualPrice = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]>;

  try {
    if (!files || !files.mainFile || !files.discountFile) {
      return responseHelper.throwBadRequestError("mainFile and discountFile are required", res);
    }

    if (
      files.mainFile[0].mimetype !== excelMimetype ||
      files.discountFile[0].mimetype !== excelMimetype ||
      (files.customFile && files.customFile[0].mimetype !== excelMimetype)
    ) {
      return responseHelper.throwBadRequestError("File must be an excel file", res);
    }

    const excel = await ExcelModel.findOne({ type: "shopee_product" });

    if (!excel) {
      return responseHelper.throwBadRequestError("Excel type not found", res);
    }

    const mainFileName = files.mainFile[0].originalname;

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
      getSheetData(files.mainFile[0].buffer, excel.columns, excel.startRowIndex),
      getSheetData(files.discountFile[0].buffer, discountFileColumns, 2),
    ]);

    const discountPriceMap = new Map<string, { price: number }>();

    discountSheet.forEach((row) => {
      const productKey = row[excel.primaryColumn];
      if (discountPriceMap.has(productKey)) return;
      discountPriceMap.set(productKey, { price: row.harga_diskon });
    });

    const customPriceMap = new Map<string, { price: number }>();

    if (files.customFile) {
      const customFileColumns = [
        { key: "sku_produk", label: "SKU Produk" },
        { key: "harga_khusus", label: "Harga Khusus" },
      ];

      const customSheet = await getSheetData(files.customFile[0].buffer, customFileColumns, 2);

      customSheet.forEach((row) => {
        const productKey = row[excel.primaryColumn];
        if (customPriceMap.has(productKey)) return;
        customPriceMap.set(productKey, { price: row.harga_khusus });
      });
    }

    const updatedRows = mainSheet
      .map((row) => {
        const productKey = row[excel.primaryColumn];
        const discountPriceProduct = discountPriceMap.get(productKey);
        const customPriceProduct = customPriceMap.get(productKey);

        let price = Number(row.harga);

        if (discountPriceProduct) {
          price = discountPriceProduct.price;
        }

        if (customPriceProduct && customPriceProduct.price === price) {
          return null;
        }

        return { ...row, harga: price };
      })
      .filter((row) => row !== null);

    const outputFilename = mainFileName.substring(0, mainFileName.length - 5);
    const outputFilenameSlug = slugify(outputFilename, {
      replacement: "_",
      lower: true,
    });

    const uniqueId = new mongoose.Types.ObjectId();
    const updatedFilePath = `${outputFilenameSlug}_${uniqueId}.xlsx`;

    const updatedFileWorkbook = createExcelWorkbook(excel.columns, updatedRows);
    updatedFileWorkbook.xlsx.writeFile(path.join(__dirname, "../../public/combines", updatedFilePath));

    return responseHelper.returnOkResponse("Combine successful", res, {
      filename: outputFilename,
      path: updatedFilePath,
    });
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};
