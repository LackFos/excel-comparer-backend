import mongoose, { Schema } from "mongoose";
import { excelDocument } from "../interfaces/excel";

export const excelSchema = new Schema<excelDocument>(
  {
    type: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    primaryColumn: {
      type: String,
      required: true,
    },
    columns: {
      type: [{ key: { type: String, required: true }, label: { type: String, required: true } }],
      required: true,
    },
    filterableColumns: {
      type: [{ key: { type: String, required: true }, label: { type: String, required: true } }],
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
