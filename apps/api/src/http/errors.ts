import { ApiErrorDetail, ERROR_CODES } from '@maxr/shared';
import { AppError } from './app-error';

/**
 * Factories for the standard error responses (AGENTS.md §5). Services and middleware
 * throw these; the error handler is the only place that turns them into HTTP.
 */
export const badRequest = (message: string, details?: ApiErrorDetail[]) =>
  new AppError(400, ERROR_CODES.BAD_REQUEST, message, details);

export const validationError = (details: ApiErrorDetail[], message = 'Request validation failed') =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);

export const unauthorized = (message = 'Authentication is required') =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

/** Also used for records outside the caller's scope, so their existence is not revealed. */
export const notFound = (message = 'The requested resource was not found') =>
  new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (message: string) => new AppError(409, ERROR_CODES.CONFLICT, message);

/** A business rule was violated (for example an illegal state transition). */
export const unprocessable = (message: string, details?: ApiErrorDetail[]) =>
  new AppError(422, ERROR_CODES.UNPROCESSABLE_ENTITY, message, details);

export const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(429, ERROR_CODES.RATE_LIMITED, message);
