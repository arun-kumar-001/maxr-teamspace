import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { loadHttpConfig } from './http-config';

describe('rate limiting (TC-9-16)', () => {
  const tight = { trustProxy: 0, rateLimit: { windowMs: 60_000, max: 3 } };

  it('answers 429 with the standard envelope, a request id and Retry-After once the limit is exceeded', async () => {
    const { app } = makeApp({ http: tight });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/api/v1/templates')).status).toBe(200);
    }
    const res = await request(app).get('/api/v1/templates');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers['ratelimit']).toBeTruthy();
  });

  it('does not rate limit the health check', async () => {
    const { app } = makeApp({ http: { trustProxy: 0, rateLimit: { windowMs: 60_000, max: 1 } } });
    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/api/v1/health')).status).toBe(200);
    }
  });

  it('counts per client IP when behind a trusted proxy', async () => {
    const { app } = makeApp({ http: { trustProxy: 1, rateLimit: { windowMs: 60_000, max: 2 } } });
    const hit = (ip: string) => request(app).get('/api/v1/templates').set('X-Forwarded-For', ip);
    expect((await hit('10.0.0.1')).status).toBe(200);
    expect((await hit('10.0.0.1')).status).toBe(200);
    expect((await hit('10.0.0.1')).status).toBe(429);
    expect((await hit('10.0.0.2')).status).toBe(200);
  });

  it('every error carries the envelope even when logging is silent', async () => {
    const { app } = makeApp({ http: tight });
    for (let i = 0; i < 4; i++) await request(app).get('/api/v1/templates');
    const res = await request(app).get('/api/v1/templates');
    expect(Object.keys(res.body)).toEqual(['error']);
  });
});

describe('http config', () => {
  it('has safe defaults', () => {
    expect(loadHttpConfig({})).toEqual({
      trustProxy: 0,
      rateLimit: { windowMs: 60_000, max: 300 },
      loginRateLimit: { windowMs: 900_000, max: 10 },
    });
  });
  it('reads values from the environment', () => {
    expect(
      loadHttpConfig({ TRUST_PROXY: '1', RATE_LIMIT_WINDOW_MS: '5000', RATE_LIMIT_MAX: '9' }),
    ).toEqual({
      trustProxy: 1,
      rateLimit: { windowMs: 5000, max: 9 },
      loginRateLimit: { windowMs: 900_000, max: 10 },
    });
  });
  it.each([
    { TRUST_PROXY: '-1' },
    { TRUST_PROXY: 'yes' },
    { RATE_LIMIT_MAX: '0' },
    { RATE_LIMIT_WINDOW_MS: '10' },
    { RATE_LIMIT_MAX: '1.5' },
  ])('fails fast on invalid %j', (env) => {
    expect(() => loadHttpConfig(env as NodeJS.ProcessEnv)).toThrow(/Config Error/);
  });
});
