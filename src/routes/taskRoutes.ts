import express from "express";
import multer from "multer";
import {
  getAllTasks,
  getTaskDetail,
  createTask,
  updateTask,
  submitTask,
  downloadTask,
} from "../controllers/taskController";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router
  .route("/")
  .get(getAllTasks) // GET all tasks
  .post(upload.single("file"), createTask); // POST a new task

router
  .route("/:id")
  .get(getTaskDetail) // GET single task
  .patch(updateTask); // PATCH update a task

// POST compare a task with new excel
router.post("/:id/submit", upload.single("file"), submitTask);

// POST download a zip that contain list of tasks excel
router.post("/download", downloadTask);

export default router;
