import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { endOfDay, startOfDay } from "date-fns";
import responseHelper from "../libs/helpers/responseHelper";
import { getExcelSheetData } from "../libs/helpers/excelHelper";
import { filterDuplicate } from "../libs/utils";
import TaskModel from "../models/TaskModel";
import { TaskStatus } from "../libs/enum";
import archiver from "archiver";

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
      .select("name status targetColumn file createdAt");

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
      const message = task ? "Excel related to the task not found" : "Task not found";
      return responseHelper.throwNotFoundError(message, res);
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
  const file = req.file!;
  const { name, type, config, targetColumn } = req.body;
  const selectedExcel = req.body.selectedExcel; // This one from request middleware

  try {
    const taskId = new mongoose.Types.ObjectId();

    const taskFilename = `${taskId}.xlsx`;

    fs.writeFileSync(path.join(__dirname, "../../public/tasks", taskFilename), file.buffer);

    const createdTask = await TaskModel.create({
      _id: taskId,
      name,
      config,
      targetColumn,
      type,
      status: TaskStatus.PENDING,
      excel: selectedExcel.id,
      file: taskFilename,
    });

    return responseHelper.returnCreatedResponse("Task", createdTask, res);
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
  const { status } = req.body;

  try {
    const task = await TaskModel.findByIdAndUpdate(
      taskId,
      { status },
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
  const file = req.file;

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
      getExcelSheetData(
        path.join(__dirname, "../../public/tasks", task.file),
        task.excel.columns,
        2
      ),
      getExcelSheetData(file!.buffer, task.excel.columns, task.excel.startRowIndex),
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

        if (!product || product.value === undefined) return null;

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

export const downloadTask = async (req: Request, res: Response) => {
  try {
    const tasks = await TaskModel.find({ _id: { $in: req.body.tasks } });

    const filesToZip = tasks.map((task) => ({ name: task.name, path: task.file }));

    const zip = archiver("zip", {
      zlib: { level: 9 },
    });

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=tugas.zip`,
    });

    zip.pipe(res);

    const baseDirectory = path.join(__dirname, "../../public/tasks");

    filesToZip.forEach((file) => {
      zip.file(path.join(baseDirectory, file.path), { name: `${file.name}.xlsx` });
    });

    zip.finalize();
  } catch (error) {
    return responseHelper.throwInternalError(
      "Something went wrong, please try again later.",
      res,
      error
    );
  }
};
