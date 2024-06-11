import { array, date, number, object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { TaskStatus } from "../libs/enum";
import responseHelper from "../libs/helpers/responseHelper";
import { isExcelFile, validateRequest } from "../libs/utils";
import ExcelModel from "../models/ExcelModel";

export const getAllTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateParamsSchema = object({
      startDate: date(),
      endDate: date(),
    });
    await validateRequest(dateParamsSchema, req.query); // Validate

    next();
  } catch (error) {
    next(error);
  }
};

export const createTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const excelDocuments = await ExcelModel.find();
    const validTypes = excelDocuments.map((document) => document.type);

    const taskSchema = object({
      name: string().required(),
      type: string().required().oneOf(validTypes),
      config: array()
        .of(
          object({
            start: string().required().required(),
            end: string().required().required(),
            color: string()
              .required()
              .matches(/^#[0-9A-Fa-f]{6}$/, "config.color must be a valid hex code (e.g., #AABBCC)")
              .required(),
          })
        )
        .required(),
    });
    await validateRequest(taskSchema, req.body); // Validate

    const chosenExcel = excelDocuments.find((excel) => excel.type === req.body.type)!;
    req.body.chosenExcel = chosenExcel;

    const rowSchemaTemplate = chosenExcel.columns.reduce(
      (schema, column) => ({
        ...schema,
        [column]: string().notOneOf([undefined]),
      }),
      {}
    );

    const rowSchema = object({
      ...rowSchemaTemplate,
      selisih: number().required(),
      persentase: number().required(),
    });

    const rowTargetSchema = object({
      rows: array().of(rowSchema).min(1).required(),
      targetColumn: string().required().oneOf(chosenExcel.filterableColumns).required(),
    });
    await validateRequest(rowTargetSchema, req.body); // Validate

    next();
  } catch (error) {
    next(error);
  }
};

export const updateTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskSchema = object({
      status: string().required().oneOf(Object.values(TaskStatus)),
    });
    await validateRequest(taskSchema, req.body); // Validate

    next();
  } catch (error) {
    next(error);
  }
};

export const submitTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;

    if (!file || !isExcelFile(file)) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        file: "File must be an XLSX file",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
