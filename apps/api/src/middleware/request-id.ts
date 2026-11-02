import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  id?: string;
}

// Client-supplied ids end up in logs and response headers, so only a safe shape is accepted.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const supplied = req.header('x-request-id');
  const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
