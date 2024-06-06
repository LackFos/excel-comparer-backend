import { object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { isExcelFile, validateRequest } from "../libs/utils";
import responseHelper from "../libs/helpers/responseHelper";
import ExcelModel from "../models/ExcelModel";

export const compareExcelRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Check is type valid
    const excels = await ExcelModel.find();
    const validTypes = excels.map((excel) => excel.type);

    const validExcelType = object({
      type: string().required().oneOf(validTypes),
    });
    await validateRequest(validExcelType, req.body);

    //  2) Check is targetColumn valid
    const chosenExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.chosenExcel = chosenExcel;

    const validTargetColumn = object({
      targetColumn: string().required().oneOf(chosenExcel.filterableColumns),
    });
    await validateRequest(validTargetColumn, req.body);

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

    const validExcelType = object({
      type: string().required().oneOf(validTypes),
    });
    await validateRequest(validExcelType, req.body);

    //  2) Check is targetColumn valid
    const chosenExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.chosenExcel = chosenExcel;

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
