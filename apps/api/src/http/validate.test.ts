import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';

const key = () => `key-${Math.random().toString(36).slice(2, 12)}-abcdef`;

describe('validation (TC-9-01 .. TC-9-03)', () => {
  const { app } = makeApp();

  it('TC-9-01 rejects an invalid body with 400 VALIDATION_ERROR and field details', async () => {
    const res = await request(app).post('/api/v1/templates').set('Idempotency-Key', key()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'body.name' })]),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
  });

  it('TC-9-01 rejects unknown body fields (strict) so clients cannot smuggle extra data', async () => {
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Idempotency-Key', key())
      .send({ name: 'ok', role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].rule).toBe('unrecognized_keys');
  });

  it('TC-9-02 rejects a non-UUID :id before it can reach SQL', async () => {
    const res = await request(app).get('/api/v1/templates/1;DROP TABLE users');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('params.id');
  });

  it('TC-9-03 rejects unknown query keys and wrong types', async () => {
    const unknown = await request(app).get('/api/v1/templates?foo=1');
    expect(unknown.status).toBe(400);
    const wrongType = await request(app).get('/api/v1/templates?page=abc');
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.details[0].field).toBe('query.page');
  });

  it('reports problems in params, query and body together', async () => {
    const res = await request(app).put('/api/v1/templates/not-a-uuid').send({ name: '' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['params.id', 'body.name']));
  });
});
