import express from "express";
import multer from "multer";
import { compareExcel, findMissingSku } from "../controllers/excelController";
import { compareExcelRequest, findMissingSkuRequest } from "../requests/excelRequest";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/compare",
  upload.fields([{ name: "mainFile", maxCount: 1 }, { name: "secondaryFiles" }]),
  compareExcelRequest,
  compareExcel
);

router.post(
  "/missing-sku",
  upload.fields([{ name: "mainFile", maxCount: 1 }, { name: "secondaryFiles" }]),
  findMissingSkuRequest,
  findMissingSku
);

export default router;
