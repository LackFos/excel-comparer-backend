import mongoose, { Schema } from "mongoose";
import { excelDocument } from "../interfaces/excel";

export const excelSchema = new Schema<excelDocument>(
  {
    type: {
      type: String,
      required: true,
    },
    primaryColumn: {
      type: String,
      required: true,
    },
    columns: {
      type: [String],
      required: true,
    },
    columnLabels: {
      type: [String],
      required: true,
    },
    filterableColumns: {
      type: [String],
      required: true,
    },
    startRowIndex: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default mongoose.model("Excel", excelSchema);
