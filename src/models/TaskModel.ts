import mongoose, { Schema } from "mongoose";
import { TaskStatus } from "../libs/enum";
import { taskDocument } from "../interfaces/task";

const taskSchema = new Schema<taskDocument>(
  {
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: TaskStatus,
      required: true,
    },
    file: {
      type: String,
      required: true,
    },
    targetColumn: {
      type: String,
      required: true,
    },
    config: {
      type: [
        {
          start: { type: String, required: true },
          end: { type: String, required: true },
          color: { type: String, required: true },
        },
      ],
      required: true,
      default: [],
    },
    excel: {
      type: mongoose.Schema.ObjectId,
      ref: "Excel",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default mongoose.model("Task", taskSchema);
