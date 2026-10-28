import { Request, Response, NextFunction } from 'express';
import { ApiErrorEnvelope, ERROR_CODES, StandardErrorCode } from '@maxr/shared';
import { RequestWithId } from './request-id';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: StandardErrorCode | string;
  public readonly details?: Array<{ field?: string; message: string; rule?: string }>;

  constructor(
    statusCode: number,
    code: StandardErrorCode | string,
    message: string,
    details?: Array<{ field?: string; message: string; rule?: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const reqWithId = req as RequestWithId;
  const requestId = reqWithId.id;

  let statusCode = 500;
  let code: StandardErrorCode | string = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected internal server error occurred';
  let details: Array<{ field?: string; message: string; rule?: string }> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SyntaxError' && 'status' in err) {
    // Malformed JSON body
    statusCode = 400;
    code = ERROR_CODES.BAD_REQUEST;
    message = 'Malformed JSON in request body';
  }

  const envelope: ApiErrorEnvelope = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  // Log internal server errors (redacting PII)
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[Error] ${req.method} ${req.url} - RequestId: ${requestId} - ${err.message}`);
  }

  res.status(statusCode).json(envelope);
}
