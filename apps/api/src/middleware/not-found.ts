import { Request, Response } from 'express';
import { ApiErrorEnvelope, ERROR_CODES } from '@maxr/shared';
import { RequestWithId } from './request-id';

export function notFoundHandler(req: Request, res: Response): void {
  const reqWithId = req as RequestWithId;
  const envelope: ApiErrorEnvelope = {
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `The requested resource '${req.method} ${req.originalUrl}' was not found`,
      ...(reqWithId.id ? { requestId: reqWithId.id } : {}),
    },
  };
  res.status(404).json(envelope);
}
