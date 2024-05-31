export enum TaskStatus {
  PENDING = "pending",
  DONE = "done",
  REVISION = "revision",
}

export enum ExcelOperator {
  GREATER_THAN = "greater_than",
  LESSER_THAN = "lesser_than",
  EQUAL = "equal",
}

export enum StatusCode {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUEST = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}
