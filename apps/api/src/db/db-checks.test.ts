import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logging/logger';

// Fake drivers: the checks must turn any failure into { status: 'down' } without error text.
const poolQuery = vi.hoisted(() => vi.fn());
const redisState = vi.hoisted(() => ({ connect: vi.fn(), ping: vi.fn(), status: 'wait' }));

vi.mock('pg', () => ({
  Pool: class {
    on() {}
    query = poolQuery;
    end = vi.fn();
  },
}));
vi.mock('ioredis', () => ({
  default: class {
    get status() {
      return redisState.status;
    }
    on() {}
    connect = redisState.connect;
    ping = redisState.ping;
    quit = vi.fn();
  },
}));

import { checkDatabaseHealth } from './client';
import { checkRedisHealth } from './redis';

function capture() {
  const lines: string[] = [];
  return { lines, logger: createLogger({ level: 'debug', write: (l) => lines.push(l) }) };
}

beforeEach(() => {
  poolQuery.mockReset();
  redisState.connect.mockReset();
  redisState.ping.mockReset();
  redisState.status = 'wait';
});

describe('checkDatabaseHealth', () => {
  it('is up when SELECT 1 succeeds', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    const { logger, lines } = capture();
    const result = await checkDatabaseHealth(logger);
    expect(result).toEqual({ status: 'up', latencyMs: expect.any(Number) });
    expect(lines).toHaveLength(0);
  });

  it('is down without any error text in the result, and logs the cause', async () => {
    poolQuery.mockRejectedValue(new Error('getaddrinfo ENOTFOUND secret-db.internal'));
    const { logger, lines } = capture();
    const result = await checkDatabaseHealth(logger);
    expect(result).toEqual({ status: 'down', latencyMs: expect.any(Number) });
    expect(Object.keys(result)).not.toContain('error');
    expect(lines.join('')).toContain('database health check failed');
  });
});

describe('checkRedisHealth', () => {
  it('is up on PONG', async () => {
    redisState.connect.mockResolvedValue(undefined);
    redisState.ping.mockResolvedValue('PONG');
    const result = await checkRedisHealth(capture().logger);
    expect(result.status).toBe('up');
  });

  it('is down on a connection failure, with no error text in the result', async () => {
    redisState.connect.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.9:6379'));
    const { logger, lines } = capture();
    const result = await checkRedisHealth(logger);
    expect(result).toEqual({ status: 'down', latencyMs: expect.any(Number) });
    expect(lines.join('')).toContain('redis health check failed');
  });

  it('is down on an unexpected ping reply', async () => {
    redisState.status = 'ready';
    redisState.ping.mockResolvedValue('NOPE');
    const result = await checkRedisHealth(capture().logger);
    expect(result.status).toBe('down');
  });
});
