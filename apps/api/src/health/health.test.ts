import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';

const up = { status: 'up' as const, latencyMs: 2 };
const down = { status: 'down' as const, latencyMs: 5 };

describe('health endpoint', () => {
  it('200 healthy when the database and Redis are up', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'healthy',
      service: 'maxr-api',
      dependencies: { database: { status: 'up' }, redis: { status: 'up' } },
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('the response has exactly these fields and nothing else (nothing can leak by accident)', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/health');
    expect(Object.keys(res.body).sort()).toEqual([
      'dependencies',
      'environment',
      'service',
      'status',
      'timestamp',
      'uptimeSeconds',
      'version',
    ]);
    expect(Object.keys(res.body.dependencies).sort()).toEqual(['database', 'redis']);
    for (const dependency of Object.values<Record<string, unknown>>(res.body.dependencies)) {
      expect(Object.keys(dependency).sort()).toEqual(['latencyMs', 'status']);
    }
  });

  it('503 degraded when the database is down', async () => {
    const { app } = makeApp({
      health: { checkDatabase: async () => down, checkRedis: async () => up },
    });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.database.status).toBe('down');
  });

  it('200 degraded when only Redis (a cache) is down', async () => {
    const { app } = makeApp({
      health: { checkDatabase: async () => up, checkRedis: async () => down },
    });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
  });

  it('SECURITY: a failing check never leaks error text, only the log has it', async () => {
    const { app, lines } = makeApp({
      health: {
        checkDatabase: async () => {
          throw new Error('getaddrinfo ENOTFOUND db.internal password=hunter2');
        },
        checkRedis: async () => up,
      },
    });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.dependencies.database).toEqual({
      status: 'down',
      latencyMs: expect.any(Number),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ENOTFOUND|db\.internal|hunter2|error/i);
    expect(lines.join('\n')).toContain('health check threw');
    expect(lines.join('\n')).not.toContain('hunter2');
  });

  it('there is exactly one health route: /api/health does not exist', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/health')).status).toBe(404);
  });

  it('is not rate limited', async () => {
    const { app } = makeApp({ http: { trustProxy: 0, rateLimit: { windowMs: 60_000, max: 1 } } });
    for (let i = 0; i < 4; i++) {
      expect((await request(app).get('/api/v1/health')).status).toBe(200);
    }
  });
});
