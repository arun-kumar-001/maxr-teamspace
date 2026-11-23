import { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { tooManyRequests } from './errors';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Return true to skip limiting (for example health checks). */
  skip?: (req: Request) => boolean;
}

/**
 * Per-IP rate limiter that answers with the standard 429 envelope and a Retry-After header.
 * The store is in-memory per process; a Redis store replaces it once the Redis client is
 * available (issues #4 and #7). Behind Nginx, TRUST_PROXY must be set or every client shares one IP.
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: options.skip,
    handler: (_req, _res, next) => next(tooManyRequests()),
  });
}

/** Limiter for credential endpoints such as POST /auth/login (wired in issue #7): 10 per 15 minutes. */
export const strictLimiterOptions: RateLimiterOptions = { windowMs: 15 * 60_000, max: 10 };
