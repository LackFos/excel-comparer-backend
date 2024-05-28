import { MulterError } from "multer";
import { ValidationError } from "yup";
import { NextFunction, Request, Response } from "express";
import responseHelper from "../libs/helpers/responseHelper";

const handleValidationError = (error: ValidationError, res: Response) => {
  let errors: Record<string, string> = {};

  error.inner.forEach((error) => {
    if (error.path) {
      errors[error.path] = error.errors[0];
    }
  });

  responseHelper.throwBadRequestError("Invalid request body", res, errors);
};

const handleMulterError = (error: MulterError, res: Response) => {
  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    if (error.field) {
      return responseHelper.throwBadRequestError(
        `Invalid request body: unexpected file upload`,
        res,
        {
          [error.field]:
            "This field does not accept files or only a single file is allowed.",
        }
      );
    }

    return responseHelper.throwBadRequestError("Invalid request body", res);
  }
};

const ErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.name === "ValidationError") return handleValidationError(err, res);
  if (err.name === "MulterError") return handleMulterError(err, res);
};

export default ErrorHandler;
