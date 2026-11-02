import { AppError } from './app-error';
import { badRequest, conflict, unprocessable } from './errors';

/**
 * Translates PostgreSQL error codes into standard API errors so SQL text, table names and
 * values never reach the client. Returns null when the error is not a recognised DB error.
 * Based on the `code` property only, so this file does not depend on the `pg` package.
 */
export function mapDatabaseError(err: unknown): AppError | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') {
    return null;
  }
  switch (code) {
    case '23505': // unique_violation
      return conflict('A record with the same unique value already exists');
    case '23503': // foreign_key_violation
      return unprocessable('The referenced record does not exist or is still in use');
    case '23502': // not_null_violation
    case '23514': // check_violation
      return unprocessable('The data violates a database constraint');
    case '22P02': // invalid_text_representation (e.g. malformed uuid)
    case '22001': // string_data_right_truncation
      return badRequest('A value has an invalid format or is too long');
    default:
      return null;
  }
}
