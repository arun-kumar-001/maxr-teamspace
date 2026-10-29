import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';

describe('request id (#52 F5)', () => {
  it('keeps a safe client supplied id', async () => {
    const res = await request(makeApp().app).get('/api/v1/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it.each([['a'.repeat(65)], ['bad id with spaces'], ['x;y'], ['<script>']])(
    'replaces an unsafe id %j with a generated one',
    async (bad) => {
      const res = await request(makeApp().app).get('/api/v1/health').set('x-request-id', bad);
      expect(res.headers['x-request-id']).not.toBe(bad);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('does not advertise the framework', async () => {
    const res = await request(makeApp().app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
