import { StandardErrorCode } from '@maxr/shared';

export type ErrorDetails = Array<{ field?: string; message: string; rule?: string }>;

/** An error that is safe to show to the client (status, code and message are intentional). */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: StandardErrorCode | string;
  public readonly details?: ErrorDetails;

  constructor(
    statusCode: number,
    code: StandardErrorCode | string,
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
