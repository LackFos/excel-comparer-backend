import mongoose from "mongoose";

export interface excelDocument {
  id: mongoose.Types.ObjectId;
  type: string;
  name: string;
  primaryColumn: string;
  columns: { key: string; label: string }[];
  filterableColumns: { key: string; label: string }[];
  startRowIndex: number;
}
