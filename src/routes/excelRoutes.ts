import express from "express";
import multer from "multer";
import { compareExcel, findActualPrice, findMissingSku, getAllExcels } from "../controllers/excelController";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", getAllExcels);

router.post("/compare", upload.fields([{ name: "mainFile", maxCount: 1 }, { name: "secondaryFiles" }]), compareExcel);

router.post("/missing-sku", upload.fields([{ name: "mainFile", maxCount: 1 }, { name: "secondaryFiles" }]), findMissingSku);

router.post(
  "/actual-price",
  upload.fields([
    { name: "mainFile", maxCount: 1 },
    { name: "discountFile", maxCount: 1 },
    { name: "customFile", maxCount: 1 },
  ]),
  findActualPrice
);

export default router;
