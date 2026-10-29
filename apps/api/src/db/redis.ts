import Redis from 'ioredis';
import { config } from '../config/env';
import { Logger, getLogger } from '../logging/logger';
import { DependencyStatus } from './types';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying quickly in tests
        return Math.min(times * 100, 1000);
      },
    });

    redisClient.on('error', (err) => {
      // Expected while Redis is not running locally; quiet in tests.
      if (config.NODE_ENV !== 'test') {
        getLogger().warn('redis connection error', { err });
      }
    });
  }
  return redisClient;
}

export async function checkRedisHealth(logger: Logger = getLogger()): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    if (pong === 'PONG') {
      return { status: 'up', latencyMs: Date.now() - start };
    }
    logger.warn('redis health check got an unexpected ping reply');
    return { status: 'down', latencyMs: Date.now() - start };
  } catch (err) {
    logger.warn('redis health check failed', { err });
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}
