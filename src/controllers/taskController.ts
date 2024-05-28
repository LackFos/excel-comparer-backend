import mongoose from "mongoose";
import { Request, Response } from "express";
import TaskModel from "../models/TaskModel";
import { TaskStatus } from "../libs/enum";
import responseHelper from "../libs/helpers/responseHelper";
import {
  createTaskFile,
  readExcelFile,
  getExcelSheetData,
  readExcelBuffer,
} from "../libs/helpers/excelHelper";
import { CreateTaskParams, UpdateTaskParams } from "../libs/types";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

export const getAllTask = async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  try {
    const dateFilters: Record<string, Date> = {};

    if (startDate) {
      dateFilters["$gte"] = startOfDay(startDate as string);
      dateFilters["$lte"] = endOfDay(startDate as string);

      if (endDate) {
        dateFilters["$lte"] = endOfDay(endDate as string);
      }
    }

    const tasks = await TaskModel.find({ createdAt: dateFilters }).populate("excel");

    if (tasks.length === 0) {
      return responseHelper.throwNotFoundError("No tasks found", res);
    }

    return responseHelper.returnOkResponse("tasks found", res, tasks);
  } catch (err) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      err
    );
  }
};

export const getTaskdetail = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;

  try {
    const task = await TaskModel.findById(taskId).populate("excel");

    if (!task) return responseHelper.throwNotFoundError("Task not found", res);
    if (!task.excel) return responseHelper.throwNotFoundError("Task related excel not found", res);

    const excel = await readExcelFile(task.file!);
    const rows = getExcelSheetData(excel, "Sheet1", task.excel.columns, 2);

    const taskDetail = {
      ...task.toJSON(),
      columns: task.excel.columnLabels,
      rows,
    };

    return responseHelper.returnOkResponse("Task found", res, taskDetail);
  } catch (err) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      err
    );
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const { name, rows, config, targetColumn }: CreateTaskParams = req.body;

  try {
    const objectId = new mongoose.Types.ObjectId();

    const taskFilePath = `public/task/${objectId}.xlsx`;
    await createTaskFile(rows, taskFilePath);

    const createdTask = await TaskModel.create({
      name,
      config,
      targetColumn,
      status: TaskStatus.PENDING,
      excel: req.body.chosenExcel.id,
      file: taskFilePath,
    });

    const taskDetail = {
      ...createdTask.toJSON(),
      columns: req.body.chosenExcel.columnLabels,
      rows,
    };

    return responseHelper.returnCreatedResponse("Task", taskDetail, res);
  } catch (err) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      err
    );
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const { name, status }: UpdateTaskParams = req.body;

  try {
    const task = await TaskModel.findById(taskId).populate("excel");
    if (!task) return responseHelper.throwNotFoundError("Task not found", res);
    if (!task.excel) return responseHelper.throwNotFoundError("Task related excel not found", res);

    if (name) {
      task.name = name;
      await task.save({ validateBeforeSave: true });
    }

    if (status) {
      if (task.status === TaskStatus.DONE) {
        return responseHelper.throwConflictError(
          "Task is already concluded and cannot be changed",
          res
        );
      } else {
        task.status = status;
        await task.save({ validateBeforeSave: true });
      }
    }

    const excel = await readExcelFile(task.file!);
    const rows = getExcelSheetData(excel, "Sheet1", task.excel.columns, 2);

    const taskDetail = {
      ...task.toJSON(),
      columns: task.excel.columnLabels,
      rows,
    };

    return responseHelper.returnOkResponse("Task successfully updated!", res, taskDetail);
  } catch (err) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      err
    );
  }
};

export const submitTask = async (req: Request, res: Response) => {
  const taskId = req.params.id;
  const file = req.file;

  try {
    const task = await TaskModel.findById(taskId).populate("excel");

    if (!task) return responseHelper.throwNotFoundError("Task not found", res);
    if (!task.excel) return responseHelper.throwNotFoundError("Task related excel not found", res);

    const taskExcel = await readExcelFile(task.file);
    const submissionExcel = await readExcelBuffer(file!.buffer);

    const taskSheetData = getExcelSheetData(taskExcel, "Sheet1", task.excel.columns, 2);

    const submissionSheetData = getExcelSheetData(
      submissionExcel,
      "Sheet1",
      task.excel.columns,
      task.excel.startRowIndex
    );

    const productMap = new Map();
    const targetColumn = task.targetColumn;
    const primaryKey = task.excel.primaryColumn;

    taskSheetData.forEach((row: any) => {
      productMap.set(row[primaryKey], row[task.targetColumn]);
    });

    const remainingTasks = submissionSheetData.map((row: any) => {
      const taskValue = productMap.get(row[primaryKey]);
      const submissionValue = row[targetColumn];

      if (taskValue === undefined) return null;

      if (taskValue !== submissionValue) {
        return { ...row, isModified: true };
      }

      return row;
    });

    const taskDetail = {
      ...task.toJSON(),
      columns: req.body.chosenExcel.columnLabels,
      rows: remainingTasks,
    };

    return responseHelper.returnOkResponse("Remaining Task", res, taskDetail);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
