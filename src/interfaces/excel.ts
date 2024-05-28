import mongoose from "mongoose";

export interface excelDocument {
  id: mongoose.Types.ObjectId;
  type: string;
  primaryColumn: string;
  columns: string[];
  columnLabels: string[];
  filterableColumns: string[];
  startRowIndex: number;
}
