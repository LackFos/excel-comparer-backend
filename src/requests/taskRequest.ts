import { array, date, mixed, object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { TaskStatus } from "../libs/enum";
import { validateRequest } from "../libs/utils";
import ExcelModel from "../models/ExcelModel";
import { xlsxFileMimetype } from "../libs/const";

export const getAllTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRangeSchema = object({
      startDate: date(),
      endDate: date(),
    });

    await validateRequest(dateRangeSchema, req.query);

    next();
  } catch (error) {
    next(error);
  }
};

export const createTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileSchema = object({
      file: mixed()
        .required()
        .test("type", "must be an xlsx file", (file: any) => {
          return file.mimetype === xlsxFileMimetype;
        }),
    });

    await validateRequest(fileSchema, { file: req.file });

    const excelDocuments = await ExcelModel.find();
    const validTypes = excelDocuments.map((document) => document.type);

    const taskSchema = object({
      name: string().required(),
      type: string().required().oneOf(validTypes),
      config: array().of(
        object({
          start: string().required().required(),
          end: string().required().required(),
          color: string()
            .required()
            .matches(/^#[0-9A-Fa-f]{6}$/, "config.color must be a valid hex code (e.g., #AABBCC)")
            .required(),
        })
      ),
    });
    await validateRequest(taskSchema, req.body); // Validate

    const selectedExcel = excelDocuments.find((excel) => excel.type === req.body.type)!;
    req.body.selectedExcel = selectedExcel;

    const rowTargetSchema = object({
      targetColumn: string().required().oneOf(selectedExcel.filterableColumns).required(),
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
    await validateRequest(taskSchema, req.body);

    next();
  } catch (error) {
    next(error);
  }
};

export const submitTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileSchema = object({
      file: mixed()
        .required()
        .test("type", "must be an xlsx file", (file: any) => {
          return file.mimetype === xlsxFileMimetype;
        }),
    });

    await validateRequest(fileSchema, { file: req.file });

    next();
  } catch (error) {
    next(error);
  }
};
