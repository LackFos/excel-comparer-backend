import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { Express } from "express";
import connectToDatabase from "./src/database";
import taksRouter from "./src/routes/taskRoutes";
import excelRouter from "./src/routes/excelRoutes";
import ErrorHandler from "./src/controllers/errorController";

dotenv.config();
connectToDatabase();

const app: Express = express();

app.use(cors());

app.use(express.json());

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/v1/tasks", taksRouter);
app.use("/api/v1/excels", excelRouter);

app.use(ErrorHandler);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`⚡ App running at http://localhost:${port}`);
});
