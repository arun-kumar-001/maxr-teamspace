import { ApiErrorEnvelope, ERROR_CODES } from '@maxr/shared';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../http/app-error';
import { mapDatabaseError } from '../http/db-errors';
import { Logger, getLogger } from '../logging/logger';

// Re-exported so existing imports from this module keep working.
export { AppError };

/** Errors raised by Express's body parser carry a `type`. */
function fromBodyParser(err: unknown): AppError | null {
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.too.large') {
    return new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'The request body is too large');
  }
  if (type === 'entity.parse.failed' || type === 'encoding.unsupported') {
    return new AppError(400, ERROR_CODES.BAD_REQUEST, 'Malformed JSON in request body');
  }
  return null;
}

/**
 * The single place where errors become HTTP responses. Known errors keep their status and
 * message; anything unexpected becomes a generic 500 so internals never reach the client.
 * Details of 5xx errors are logged with the request id for support.
 */
export function createErrorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const appError = err instanceof AppError ? err : (fromBodyParser(err) ?? mapDatabaseError(err));

    const statusCode = appError?.statusCode ?? 500;
    const envelope: ApiErrorEnvelope = {
      error: {
        code: appError?.code ?? ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: appError?.message ?? 'An unexpected internal server error occurred',
        ...(appError?.details ? { details: appError.details } : {}),
        ...(req.id ? { requestId: req.id } : {}),
      },
    };

    if (statusCode >= 500) {
      logger.error('unhandled error', { requestId: req.id, method: req.method, err });
    }
    if (res.headersSent) {
      return;
    }
    res.status(statusCode).json(envelope);
  };
}

/** Default instance using the process-wide logger. */
export const errorHandler = createErrorHandler(getLogger());
