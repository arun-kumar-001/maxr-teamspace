import { RequestHandler } from 'express';
import { config } from '../config/env';
import { DependencyStatus } from '../db/types';
import { Logger, getLogger } from '../logging/logger';

export interface HealthDependencies {
  checkDatabase: () => Promise<DependencyStatus>;
  checkRedis: () => Promise<DependencyStatus>;
}

/** A check that throws must never break the endpoint: it simply counts as "down". */
async function probe(
  name: string,
  check: () => Promise<DependencyStatus>,
  logger: Logger,
): Promise<DependencyStatus> {
  const started = Date.now();
  try {
    return await check();
  } catch (err) {
    logger.warn('health check threw', { dependency: name, err });
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

/**
 * GET /api/v1/health (unauthenticated, so it reveals as little as possible).
 *  - database down            -> 503 (the API cannot serve requests)
 *  - only Redis down          -> 200 `degraded` (Redis is a cache, not the source of truth)
 *  - everything up            -> 200 `healthy`
 * Error details are logged with the request id, never returned.
 */
export function createHealthHandler(
  deps: HealthDependencies,
  logger: Logger = getLogger(),
): RequestHandler {
  return async (_req, res) => {
    const [database, redis] = await Promise.all([
      probe('database', deps.checkDatabase, logger),
      probe('redis', deps.checkRedis, logger),
    ]);

    const databaseUp = database.status === 'up';
    res.status(databaseUp ? 200 : 503).json({
      status: databaseUp && redis.status === 'up' ? 'healthy' : 'degraded',
      service: 'maxr-api',
      version: '0.1.0',
      environment: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: { database, redis },
    });
  };
}
