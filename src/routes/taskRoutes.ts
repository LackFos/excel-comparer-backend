import express from "express";
import multer from "multer";
import {
  getAllTask,
  getTaskdetail,
  createTask,
  updateTask,
  submitTask,
} from "../controllers/taskController";
import {
  createTaskRequest,
  submitTaskRequest,
  updateTaskRequest,
} from "../requests/taskRequest";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST compare a task with new excel
router.post(
  "/:id/submit",
  upload.single("file"),
  submitTaskRequest,
  submitTask
);

router
  .route("/")
  .get(getAllTask) // GET all tasks
  .post(createTaskRequest, createTask); // POST a new task

router
  .route("/:id")
  .get(getTaskdetail) // GET single task
  .patch(updateTaskRequest, updateTask); // PATCH update a task

export default router;
