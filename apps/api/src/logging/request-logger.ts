import { NextFunction, Request, Response } from 'express';
import { Logger } from './logger';

/**
 * One log line per finished request. Deliberately logs only the path (no query
 * string, no body, no headers, no IP): those can carry personal data or secrets.
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const status = res.statusCode;
      const fields = {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
        durationMs,
      };
      if (status >= 500) {
        logger.error('request completed', fields);
      } else if (status >= 400) {
        logger.warn('request completed', fields);
      } else {
        logger.info('request completed', fields);
      }
    });
    next();
  };
}
