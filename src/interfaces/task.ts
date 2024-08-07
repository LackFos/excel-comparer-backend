import mongoose, { PopulatedDoc } from "mongoose";
import { TaskStatus } from "../libs/enum";
import { excelDocument } from "./excel";

export interface taskDocument {
  id: mongoose.Types.ObjectId;
  name: string;
  status: TaskStatus;
  file: string;
  targetColumn: string;
  config: {
    start: string;
    end: string;
    color: string;
  }[];
  excel: PopulatedDoc<excelDocument & mongoose.Types.ObjectId>;
}
