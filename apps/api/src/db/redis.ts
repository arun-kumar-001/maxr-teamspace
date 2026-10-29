import Redis from 'ioredis';
import { config } from '../config/env';

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
      // In local development, warn if Redis is not yet running
      // eslint-disable-next-line no-console
      if (config.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('[Redis Client Warning]', err.message);
      }
    });
  }
  return redisClient;
}

export async function checkRedisHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    const latencyMs = Date.now() - start;
    if (pong === 'PONG') {
      return { status: 'up', latencyMs };
    }
    return { status: 'down', latencyMs, error: `Unexpected ping response: ${pong}` };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: 'down',
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}
