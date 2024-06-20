import express from "express";
import multer from "multer";
import {
  compareExcel,
  findActualPrice,
  findMissingSku,
  getAllExcels,
} from "../controllers/excelController";
import {
  compareExcelRequest,
  findActualPriceRequest,
  findMissingSkuRequest,
} from "../requests/excelRequest";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", getAllExcels);

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

router.post(
  "/actual-price",
  upload.fields([
    { name: "mainFile", maxCount: 1 },
    { name: "discountFile", maxCount: 1 },
    { name: "customFile", maxCount: 1 },
  ]),
  findActualPriceRequest,
  findActualPrice
);

export default router;
