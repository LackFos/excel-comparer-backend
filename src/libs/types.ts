import { excelDocument } from "../interfaces/excel";
import { TaskStatus } from "./enum";

export type CreateTaskParams = {
  name: string;
  rows: {}[];
  config: Record<any, string>;
  targetColumn: string;
};

export type UpdateTaskParams = {
  name?: string;
  status?: TaskStatus;
};
