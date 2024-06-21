import { array, mixed, object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { validateRequest } from "../libs/utils";
import ExcelModel from "../models/ExcelModel";
import { xlsxFileMimetype } from "../libs/const";

export const compareExcelRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Check is mainFile & secondaryFiles is valid
    if (req.files) {
      const fileSchema = object({
        mainFile: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files[0].mimetype === xlsxFileMimetype;
          }),
        secondaryFiles: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files.every((file: any) => file.mimetype === xlsxFileMimetype);
          }),
      });

      await validateRequest(fileSchema, req.files);
    } else {
      const bodySchema = object({
        mainFile: object({ filename: string().required(), path: string().required() }),
        secondaryFiles: array().of(
          object({ filename: string().required(), path: string().required() })
        ),
      });

      await validateRequest(bodySchema, req.body);
    }

    // 2) Check is type valid
    const excels = await ExcelModel.find();
    const validTypes = excels.map((excel) => excel.type);

    const bodySchema = object({
      type: string().required().oneOf(validTypes),
    });

    await validateRequest(bodySchema, req.body);

    //  3) Check is targetColumn valid
    const selectedExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.selectedExcel = selectedExcel;

    const targetColumnSchema = object({
      targetColumn: string().required().oneOf(selectedExcel.filterableColumns),
    });
    await validateRequest(targetColumnSchema, req.body);

    next();
  } catch (error) {
    next(error);
  }
};

export const findMissingSkuRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Check is mainFile & secondaryFiles is valid
    if (req.files) {
      const fileSchema = object({
        mainFile: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files[0].mimetype === xlsxFileMimetype;
          }),
        secondaryFiles: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files.every((file: any) => file.mimetype === xlsxFileMimetype);
          }),
      });

      await validateRequest(fileSchema, req.files);
    } else {
      const fileSchema = object({
        mainFile: object({ filename: string().required(), path: string().required() }),
        secondaryFiles: array().of(
          object({ filename: string().required(), path: string().required() })
        ),
      });

      await validateRequest(fileSchema, req.body);
    }

    // 2) Check is type valid
    const excels = await ExcelModel.find({ type: { $regex: "_product$" } });
    const validTypes = excels.map((excel) => excel.type);

    const bodySchema = object({
      type: string().required().oneOf(validTypes),
    });
    await validateRequest(bodySchema, req.body);

    //  3) Store the related excel
    const selectedExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.selectedExcel = selectedExcel;

    next();
  } catch (error) {
    next(error);
  }
};

export const findActualPriceRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.files) {
      const fileSchema = object({
        mainFile: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files[0].mimetype === xlsxFileMimetype;
          }),
        discountFile: mixed()
          .required()
          .test("type", "must be an xlsx file", (files: any) => {
            return files.every((file: any) => file.mimetype === xlsxFileMimetype);
          }),
        customFile: mixed().test("type", "must be an xlsx file", (files: any) => {
          if (!files) {
            return true;
          }

          return files.every((file: any) => file.mimetype === xlsxFileMimetype);
        }),
      });

      await validateRequest(fileSchema, req.files);
    }

    next();
  } catch (error) {
    next(error);
  }
};
