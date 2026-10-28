import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  id?: string;
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const existingId = req.header('x-request-id');
  const requestId = existingId || randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
