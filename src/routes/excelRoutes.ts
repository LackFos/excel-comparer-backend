import express from "express";
import multer from "multer";
import { compareExcel } from "../controllers/excelController";
import { compareExcelRequest } from "../requests/excelRequest";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/compare",
  upload.fields([{ name: "mainFile", maxCount: 1 }, { name: "secondaryFiles" }]),
  compareExcelRequest,
  compareExcel
);

export default router;
