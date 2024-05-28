import { array, number, object, string } from "yup";
import { Request, Response, NextFunction } from "express";
import { ExcelOperator, TaskStatus } from "../libs/enum";
import responseHelper from "../libs/helpers/responseHelper";
import { checkExcelValidity, validateRequest } from "../libs/utils";
import ExcelModel from "../models/ExcelModel";
import { excelDocument } from "../interfaces/excel";

export const createTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    //  1) Check is name, type & config is valid
    const excels: excelDocument[] = await ExcelModel.find();
    const validTypes = excels.map((doc) => doc.type);

    const nameTypeConfigSchema = object({
      name: string().required(),
      type: string().required().oneOf(validTypes),
      config: array().of(
        object({
          color: string()
            .required()
            .test({
              test: (value, context) => {
                if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  return context.createError({
                    message: "config.color must be a valid hex code (e.g., #AABBCC),",
                  });
                }
                return true;
              },
            }),
          type: string().required().oneOf(Object.values(ExcelOperator)),
          value: number().required(),
        })
      ),
    });
    await validateRequest(nameTypeConfigSchema, req.body);

    // 2) Check is rows & targetColumn is Valid
    const chosenExcel = excels.find((excel) => excel.type === req.body.type)!;
    req.body.chosenExcel = chosenExcel;

    const rowSchemaTemplate = chosenExcel.columns.reduce(
      (schema: Record<string, any>, column: string) => {
        schema[column] = string().notOneOf([undefined]);
        return schema;
      },
      {}
    );

    const rowSchema = object().shape(rowSchemaTemplate);

    const rowTargetSchema = object({
      rows: array().of(rowSchema).min(1),
      targetColumn: string().required().oneOf(chosenExcel.filterableColumns),
    });

    await validateRequest(rowTargetSchema, req.body);

    next();
  } catch (error) {
    next(error);
  }
};

export const updateTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateTaskSchema = object({
      name: string().required(),
      status: string<TaskStatus>().oneOf(Object.values(TaskStatus)),
    });

    req.body = await validateRequest(updateTaskSchema, req.body);

    next();
  } catch (error) {
    next(error);
  }
};

export const submitTaskRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;

    if (!file || !checkExcelValidity(file)) {
      return responseHelper.throwBadRequestError("Invalid request body", res, {
        file: "file must be an xlsx file",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
