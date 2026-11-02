import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { parseCorsOrigin } from './cors-origin';

describe('security headers', () => {
  it('are on every response, including errors and 404s', async () => {
    const { app } = makeApp();
    for (const path of ['/api/v1/health', '/api/v1/auth/me', '/nope']) {
      const res = await request(app).get(path);
      expect(res.headers['x-content-type-options'], path).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('sends HSTS only in production', async () => {
    expect(
      (await request(makeApp().app).get('/api/v1/health')).headers['strict-transport-security'],
    ).toBeUndefined();
    const prod = await request(makeApp({ nodeEnv: 'production' }).app).get('/api/v1/health');
    expect(prod.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });
});

describe('CORS', () => {
  it('allows the configured origin with credentials and nobody else', async () => {
    const { app } = makeApp();
    const ok = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const evil = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    expect(evil.headers['access-control-allow-origin']).not.toBe('*');
  });
});

describe('parseCorsOrigin', () => {
  it('accepts a single origin', () => {
    expect(parseCorsOrigin('http://localhost:3000', 'development')).toBe('http://localhost:3000');
    expect(parseCorsOrigin('https://teamspace.example.com', 'production')).toBe(
      'https://teamspace.example.com',
    );
  });

  it.each([
    '*',
    'null',
    'not a url',
    'ftp://x.example',
    'https://a.example/app',
    'https://a.example/',
  ])('rejects %s', (bad) => {
    expect(() => parseCorsOrigin(bad, 'development')).toThrow(/CORS_ORIGIN/);
  });

  it('requires https in production', () => {
    expect(() => parseCorsOrigin('http://teamspace.example.com', 'production')).toThrow(/https/);
  });
});
