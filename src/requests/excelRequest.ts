import { object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { isExcelFile } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import ExcelModel from "../models/ExcelModel";

export const compareExcelRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Check is type valid
    const excels = await ExcelModel.find();
    const validTypes = excels.map((excel) => excel.type);

    const excelTypeSchema = object({
      type: string().required().oneOf(validTypes),
    });
    excelTypeSchema.validate(req.body); // validate

    //  2) Check is targetColumn valid
    const selectedExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.selectedExcel = selectedExcel;

    const targetColumnSchema = object({
      targetColumn: string().required().oneOf(selectedExcel.filterableColumns),
    });
    targetColumnSchema.validate(req.body); // validate

    // 3) Check is mainFile & secondaryFiles is exists and valid
    const files = req.files as Record<string, Express.Multer.File[]>;
    const mainFile = files?.mainFile?.[0];
    const secondaryFiles = files?.secondaryFiles;

    if (!mainFile || !isExcelFile(mainFile)) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        mainFile: "mainFile must be an xlsx file",
      });
    }

    if (!secondaryFiles || !secondaryFiles.every((file) => isExcelFile(file))) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        secondaryFiles: "secondaryFiles must be xlsx files",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const findMissingSkuRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Check is type valid
    const excels = await ExcelModel.find({ type: { $regex: "_product$" } });
    const validTypes = excels.map((excel) => excel.type);

    const excelTypeSchema = object({
      type: string().required().oneOf(validTypes),
    });
    excelTypeSchema.validate(req.body);

    //  2) Check is targetColumn valid
    const selectedExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.selectedExcel = selectedExcel;

    // 3) Check is mainFile & secondaryFiles is exists and valid
    const files = req.files as Record<string, Express.Multer.File[]>;
    const mainFile = files?.mainFile?.[0];
    const secondaryFiles = files?.secondaryFiles;

    if (!mainFile || !isExcelFile(mainFile)) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        mainFile: "mainFile must be an xlsx file",
      });
    }

    if (!secondaryFiles || !secondaryFiles.every((file) => isExcelFile(file))) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        secondaryFiles: "secondaryFiles must be xlsx files",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const findActualPriceRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { mainFile, discountFile } = req.files as Record<string, Express.Multer.File[]>;

  try {
    if (!isExcelFile(mainFile[0]) || !isExcelFile(discountFile[0])) {
      return responseHelper.throwBadRequestError("Invalid file format", res);
    }

    next();
  } catch (error) {
    next(error);
  }
};
