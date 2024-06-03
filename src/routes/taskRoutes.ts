import express from "express";
import multer from "multer";
import {
  getAllTasks,
  getTaskDetail,
  createTask,
  updateTask,
  submitTask,
} from "../controllers/taskController";
import {
  createTaskRequest,
  getAllTaskRequest,
  submitTaskRequest,
  updateTaskRequest,
} from "../requests/taskRequest";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST compare a task with new excel
router.post("/:id/submit", upload.single("file"), submitTaskRequest, submitTask);

router
  .route("/")
  .get(getAllTaskRequest, getAllTasks) // GET all tasks
  .post(createTaskRequest, createTask); // POST a new task

router
  .route("/:id")
  .get(getTaskDetail) // GET single task
  .patch(updateTaskRequest, updateTask); // PATCH update a task

export default router;
