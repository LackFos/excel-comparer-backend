import { Response } from "express";
import { StatusCode } from "../enum";

/**
 * Returning error with spesific http code error
 *
 * @param {Number} code HTTP status code for the error
 * @returns {(message: String, res: Response) => void}
 */
const throwErrorResponse = (code: number) => (msg: string, res: Response) => {
  res.status(code).send({
    success: false,
    msg: msg,
  });
};

/**
 * Return Bad request Error preset with message and errors
 * @param {String} msg Message of the error
 * @param {import('express').Response}res
 * @param {any} errors
 */
const throwBadRequestError = (msg: string, res: Response, errors: any = undefined) => {
  res.status(StatusCode.BAD_REQUEST).send({
    success: false,
    msg: msg,
    errors,
  });
};

/**
 * Return Internal Error preset with message
 * @param {String} msg Message of the error
 * @param {import('express').Response}res
 * @param {any} error
 */
const throwInternalError = (msg: string, res: Response, error: any) => {
  res.status(StatusCode.INTERNAL_SERVER_ERROR).send({
    success: false,
    msg: msg,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
};

/**
 * Return error connection for the database
 * @param {import('express').Response} res
 */
const throwConnectionError = (res: Response) => {
  res.status(StatusCode.INTERNAL_SERVER_ERROR).send({
    success: false,
    msg: "Connection can't established. Please try again later",
  });
};

/**
 * Return Created Response Preset with created document as payload
 * @param {String} model The model name of the created document
 * @param {any} payload Payload of the document after created
 * @param {import('express').Response} res
 */
const returnCreatedResponse = (model: string, payload: any, res: Response) => {
  res.status(StatusCode.CREATED).send({
    success: true,
    msg: `${model} successfully created!`,
    payload,
  });
};

/**
 * Return OK Response Preset with payload optionally
 * @param {String} msg Success message for the response
 * @param {import('express').Response} res
 * @param {any} payload Payload for the response (Optional)
 */
const returnOkResponse = (msg: string, res: Response, payload?: any) => {
  res.status(StatusCode.OK).send({
    success: true,
    msg,
    payload,
  });
};

export default {
  /**
   * Bad Request with 401 Code
   * @param {String} msg Failed message for the response
   * @param {import('express').Response} res
   */
  throwUnauthorizedError: throwErrorResponse(StatusCode.UNAUTHORIZED),
  /**
   * Bad Request with 403 Code
   * @param {String} msg Failed message for the response
   * @param {import('express').Response} res
   */
  throwForbiddenError: throwErrorResponse(StatusCode.FORBIDDEN),
  /**
   * Bad Request with 404 Code
   * @param {String} msg Failed message for the response
   * @param {import('express').Response} res
   */
  throwNotFoundError: throwErrorResponse(StatusCode.NOT_FOUND),
  /**
   * Bad Request with 409 Code
   * @param {String} msg Failed message for the response
   * @param {import('express').Response} res
   */
  throwConflictError: throwErrorResponse(StatusCode.CONFLICT),
  throwBadRequestError,
  throwInternalError,
  throwConnectionError,
  returnCreatedResponse,
  returnOkResponse,
};
