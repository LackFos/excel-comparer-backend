import mongoose from "mongoose";
import { Request, Response } from "express";
import { endOfDay, startOfDay } from "date-fns";
import { TaskStatus } from "../libs/enum";
import responseHelper from "../libs/helpers/responseHelper";
import { createExcelWorkbook, getExcelSheetData } from "../libs/helpers/excelHelper";
import { capitalizeWords, filterDuplicate } from "../libs/utils";
import TaskModel from "../models/TaskModel";

export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  try {
    const dateFilters: Record<string, any> = {};

    if (startDate) {
      dateFilters.createdAt = {
        $gte: startOfDay(String(startDate)),
        $lte: endOfDay(String(endDate || startDate)),
      };
    }

    const tasks = await TaskModel.find(dateFilters)
      .populate({
        path: "excel",
        select: "name type",
      })
      .select("name status targetColumn createdAt");

    const message = tasks.length > 0 ? `Task found` : `No task found`;

    return responseHelper.returnOkResponse(message, res, tasks);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const getTaskDetail = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;

  try {
    const task = await TaskModel.findById(taskId)
      .populate({
        path: "excel",
        select: "primaryColumn columns",
      })
      .select("name status config targetColumn file");

    if (!task || !task.excel) {
      const errorMessage = task ? "Excel related to the task not found" : "Task not found";
      return responseHelper.throwNotFoundError(errorMessage, res);
    }

    const taskSheet = await getExcelSheetData(task.file, task.excel.columns, 2);

    const taskData = {
      ...task.toJSON(),
      rows: taskSheet,
    };

    return responseHelper.returnOkResponse("Task found", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const { name, rows, type: taskType, config, targetColumn } = req.body;
  const selectedExcel = req.body.selectedExcel;

  try {
    const taskId = new mongoose.Types.ObjectId();

    const taskName = capitalizeWords(`${name} ${selectedExcel.name}`);
    const taskFilePath = `public/tasks/${taskId}.xlsx`;
    const taskWorkbook = createExcelWorkbook(selectedExcel.columns, rows);

    taskWorkbook.xlsx.writeFile(taskFilePath);

    const createdTask = await TaskModel.create({
      _id: taskId,
      name: taskName,
      config,
      targetColumn,
      type: taskType,
      status: TaskStatus.PENDING,
      excel: selectedExcel.id,
      file: taskFilePath,
    });

    const taskData = {
      ...createdTask.toJSON(),
      rows,
    };

    return responseHelper.returnCreatedResponse("Task", taskData, res);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const { status: taskStatus } = req.body;

  try {
    const task = await TaskModel.findByIdAndUpdate(
      taskId,
      { status: taskStatus },
      { new: true, runValidators: true }
    )
      .populate({
        path: "excel",
        select: "primaryColumn columns columnLabels",
      })
      .select("name status targetColumn file");

    if (!task || !task.excel) {
      const errorMessage = task ? "Excel related to the task not found" : "Task not found";
      return responseHelper.throwNotFoundError(errorMessage, res);
    }

    const taskSheet = await getExcelSheetData(task.file, task.excel.columns, 2);

    const taskData = {
      ...task.toJSON(),
      rows: taskSheet,
    };

    return responseHelper.returnOkResponse("Task successfully updated!", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong. Please try again later.",
      res,
      error
    );
  }
};

export const submitTask = async (req: Request, res: Response) => {
  const taskId = req.params.id;
  const submissionFile = req.file;

  try {
    const task = await TaskModel.findById(taskId)
      .populate({
        path: "excel",
        select: "primaryColumn columns",
      })
      .select("name status config targetColumn file");

    if (!task || !task.excel) {
      const errorMessage = task ? "Task related excel not found" : "Task not found";
      return responseHelper.throwNotFoundError(errorMessage, res);
    }

    const [taskSheet, submissionSheet] = await Promise.all([
      getExcelSheetData(task.file, task.excel.columns, 2),
      getExcelSheetData(submissionFile!.buffer, task.excel.columns, task.excel.startRowIndex),
    ]);

    const submissionDuplicates = filterDuplicate(
      submissionSheet.map((row) => row[task.excel!.primaryColumn]),
      task.excel!.startRowIndex
    );

    const productMap = new Map<string, { value: string; selisih: number; persentase: number }>();

    taskSheet.forEach((row: any) => {
      const productId = row[task.excel!.primaryColumn];
      const { selisih, persentase } = row;

      productMap.set(productId, {
        value: row[task.targetColumn],
        selisih: Number(selisih),
        persentase: Number(persentase),
      });
    });

    const remainingTasks = submissionSheet
      .map((row) => {
        const product = productMap.get(row[task.excel!.primaryColumn]);
        const submissionValue = row[task.targetColumn];

        if (!product || product.value === undefined) {
          return null;
        }

        const item: any = {
          ...row,
          selisih: product.selisih,
          persentase: product.persentase,
          sebelumnya: product.value,
        };

        if (product.value !== submissionValue) {
          item.isModified = true;
        }

        return item;
      })
      .filter(Boolean);

    const taskData = {
      ...task.toJSON(),
      rows: remainingTasks,
      duplicated: submissionDuplicates,
    };

    return responseHelper.returnOkResponse("Remaining Task", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
