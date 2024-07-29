import fs from "fs";
import path from "path";
import archiver from "archiver";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import responseHelper from "../libs/helpers/responseHelper";
import { getSheetData } from "../libs/helpers/excelHelper";
import { filterDuplicate, isExcelFile } from "../libs/utils";
import TaskModel from "../models/TaskModel";
import { TaskStatus } from "../libs/enum";
import ExcelModel from "../models/ExcelModel";

export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  try {
    // Validation start here
    if ((startDate && !isValid(parseISO(startDate as string))) || (endDate && !isValid(parseISO(endDate as string)))) {
      const errorMessage = "startDate and endDate must be valid dates";
      return responseHelper.throwBadRequestError(errorMessage, res);
    }

    // Logic start here
    const dateFilters: Record<string, any> = {};

    if (startDate) {
      dateFilters.createdAt = {
        $gte: startOfDay(String(startDate)),
        $lte: endOfDay(String(endDate || startDate)),
      };
    }

    const tasks = await TaskModel.find(dateFilters)
      .populate({ path: "excel", select: "name type" })
      .select("name status targetColumn file createdAt");

    const message = tasks.length > 0 ? `Task found` : `No task found`;

    return responseHelper.returnOkResponse(message, res, tasks);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const getTaskDetail = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const task = await TaskModel.findById(id)
      .populate({ path: "excel", select: "primaryColumn columns" })
      .select("name status config targetColumn file");

    if (!task || !task.excel) {
      const message = task ? "Excel related to the task not found" : "Task not found";
      return responseHelper.throwNotFoundError(message, res);
    }

    const taskFilePath = path.join(__dirname, "../../public/tasks", task.file);

    const sheetColumns = [...task.excel.columns, { key: "selisih", label: "Selisih" }, { key: "persentase", label: "Persentase" }];

    const skipRow = 2;

    const taskSheet = await getSheetData(taskFilePath, sheetColumns, skipRow);

    const taskData = {
      ...task.toJSON(),
      rows: taskSheet,
    };

    return responseHelper.returnOkResponse("Task found", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const file = req.file!;
  const { name, type, config, targetColumn } = req.body;

  try {
    // Validation start here
    if (!isExcelFile(file)) {
      return responseHelper.throwBadRequestError("File must be an excel file", res);
    }

    if (!name || !type || !targetColumn) {
      return responseHelper.throwBadRequestError("Invalid request body", res);
    }

    if (
      config &&
      config.every(({ start, end, color }: { start: string; end: string; color: string }) => {
        if (!start) return false;
        if (!end) return false;
        if (!color || !color.match(/^#[0-9A-Fa-f]{6}$/)) return false;
      })
    ) {
      return responseHelper.throwBadRequestError("Invalid config value", res);
    }

    const excel = await ExcelModel.findOne({ type });

    if (!excel) {
      return responseHelper.throwBadRequestError("Excel type not found", res);
    }

    if (!excel.filterableColumns.find((column) => column.key === targetColumn)) {
      return responseHelper.throwBadRequestError("Target column doesnt valid for this excel type", res);
    }

    // Logic start here
    const id = new mongoose.Types.ObjectId();
    const taskFilename = `${id}.xlsx`;
    const taskFilePath = path.join(__dirname, "../../public/tasks", taskFilename);

    fs.writeFileSync(taskFilePath, file.buffer);

    const createdTask = await TaskModel.create({
      _id: id,
      name,
      config,
      targetColumn,
      type,
      status: TaskStatus.PENDING,
      excel: excel.id,
      file: taskFilename,
    });

    return responseHelper.returnCreatedResponse("Task", createdTask, res);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const { status } = req.body;

  try {
    if (!status) {
      return responseHelper.throwBadRequestError("Invalid request body", res);
    }

    const task = await TaskModel.findByIdAndUpdate(id, { status }, { new: true, runValidators: true })
      .populate({ path: "excel", select: "primaryColumn columns columnLabels" })
      .select("name status targetColumn file");

    if (!task || !task.excel) {
      const errorMessage = task ? "Excel related to the task not found" : "Task not found";
      return responseHelper.throwNotFoundError(errorMessage, res);
    }

    const rowSkip = 2;
    const sheetColumns = [...task.excel.columns, { key: "selisih", label: "Selisih" }, { key: "persentase", label: "Persentase" }];

    const taskFilePath = path.join(__dirname, "../../public/tasks", task.file);
    const taskSheet = await getSheetData(taskFilePath, sheetColumns, rowSkip);

    const taskData = {
      ...task.toJSON(),
      rows: taskSheet,
    };

    return responseHelper.returnOkResponse("Task successfully updated!", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong. Please try again later.", res, error);
  }
};

export const submitTask = async (req: Request, res: Response) => {
  const id = req.params.id;
  const file = req.file;

  try {
    // Validation start here
    const task = await TaskModel.findById(id)
      .populate({ path: "excel", select: "primaryColumn columns startRowIndex" })
      .select("name status config targetColumn file");

    if (!file) {
      return responseHelper.throwBadRequestError("File must be an excel file", res);
    }

    if (!task || !task.excel) {
      const errorMessage = task ? "Task related excel not found" : "Task not found";
      return responseHelper.throwNotFoundError(errorMessage, res);
    }

    // Logic start here
    const taskExcel = task.excel;

    const combinedExcelTypes = ["shopee_product"];

    // Prepare sheet data
    const taskFile = path.join(__dirname, "../../public/tasks", task.file);
    const skipTaskSheetRow = combinedExcelTypes.includes(task.excel.type) ? 2 : task.excel.startRowIndex;

    const submissionFile = file.buffer;
    const skipSubmissionSheetRow = taskExcel.startRowIndex;

    const sheetColumns = [...taskExcel.columns, { key: "selisih", label: "Selisih" }, { key: "persentase", label: "Persentase" }];

    const [taskSheet, submissionSheet] = await Promise.all([
      getSheetData(taskFile, sheetColumns, skipTaskSheetRow),
      getSheetData(submissionFile, sheetColumns, skipSubmissionSheetRow),
    ]);

    const submissionDuplicates = filterDuplicate(
      submissionSheet.map((row) => row[taskExcel.primaryColumn]),
      taskExcel.startRowIndex
    );

    const productMap = new Map<string, { value: string }>();

    // Get product reference for comparison
    submissionSheet.forEach((row) => {
      const productId = row[taskExcel.primaryColumn];

      productMap.set(productId, {
        value: row[task.targetColumn],
      });
    });

    const submissionDuplicateSet = new Set(submissionDuplicates.map((row) => row.value));

    const remainingTasks = taskSheet.map((row) => {
      const product = productMap.get(row[taskExcel.primaryColumn]);
      const submissionValue = row[task.targetColumn];

      const items: Record<string, any> = {
        ...row,
        harga: "Produk tidak ditemukan",
        sebelumnya: row[task.targetColumn],
      };

      if (!product || product.value === undefined) return items;

      items[task.targetColumn] = product.value;

      if (product.value !== submissionValue) items.isModified = true;
      if (submissionDuplicateSet.has(row[taskExcel.primaryColumn])) items.isDuplicated = true;

      return items;
    });

    const taskData = {
      ...task.toJSON(),
      rows: remainingTasks,
      duplicated: submissionDuplicates,
    };

    return responseHelper.returnOkResponse("Remaining Task", res, taskData);
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};

export const archiveTask = async (req: Request, res: Response) => {
  try {
    const tasks = await TaskModel.find({ _id: { $in: req.body.tasks } });
    const tasksNameAndFile = tasks.map((task) => ({
      name: task.name,
      file: task.file,
    }));

    const filename = `${new mongoose.Types.ObjectId()}.zip`;
    const directory = path.join(__dirname, "../../public/archives/");

    const output = fs.createWriteStream(directory + filename);

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    tasksNameAndFile.forEach((task) => {
      const filepath = path.join(__dirname, "../../public/tasks", task.file);
      archive.file(filepath, { name: `${task.name}.xlsx` });
    });

    await archive.finalize();

    return responseHelper.returnOkResponse("Archive success", res, {
      path: "public/archives/" + filename,
    });
  } catch (error) {
    return responseHelper.throwInternalError("Something went wrong, please try again later.", res, error);
  }
};
