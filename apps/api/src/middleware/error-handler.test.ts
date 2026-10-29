import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../http/app-error';
import { asyncHandler } from '../http/async-handler';
import { makeApp, makeMiniApp } from '../test/helpers';

describe('error handling (TC-9-04 .. TC-9-06, TC-9-17, TC-9-20)', () => {
  it('TC-9-04 malformed JSON gives 400 BAD_REQUEST', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('TC-9-04 a body over 1 MB gives 413 PAYLOAD_TOO_LARGE', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Idempotency-Key', 'big-body-key-1')
      .send({ name: 'x'.repeat(1_100_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('TC-9-05 a rejected async controller reaches the error handler and the server keeps serving', async () => {
    const { app } = makeMiniApp((a) => {
      a.get(
        '/boom',
        asyncHandler(async () => {
          await Promise.resolve();
          throw new AppError(409, 'CONFLICT', 'already there');
        }),
      );
      a.get('/ok', (_req, res) => res.json({ ok: true }));
    });
    const boom = await request(app).get('/boom');
    expect(boom.status).toBe(409);
    expect(boom.body.error).toMatchObject({ code: 'CONFLICT', message: 'already there' });
    expect((await request(app).get('/ok')).status).toBe(200);
  });

  it('TC-9-06 an unexpected error is a generic 500 and its details only go to the log', async () => {
    const { app, records } = makeMiniApp((a) => {
      a.get(
        '/crash',
        asyncHandler(async () => {
          throw new Error('connection to db.internal:5432 failed password=hunter2');
        }),
      );
    });
    const res = await request(app).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/db\.internal|hunter2|stack/);

    const logged = records().find((r) => r.msg === 'unhandled error');
    expect(logged).toBeTruthy();
    expect(logged?.requestId).toBe(res.body.error.requestId);
  });

  it('TC-9-17 the request id is the same in header, body and log', async () => {
    const { app, records } = makeApp();
    const res = await request(app).get('/api/v1/templates/not-a-uuid');
    const id = res.headers['x-request-id'];
    expect(id).toBeTruthy();
    expect(res.body.error.requestId).toBe(id);
    expect(records().some((r) => r.requestId === id)).toBe(true);
  });

  it('TC-9-17 a client supplied request id is echoed', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/nope').set('X-Request-Id', 'client-id-123');
    expect(res.headers['x-request-id']).toBe('client-id-123');
    expect(res.body.error.requestId).toBe('client-id-123');
  });

  it('TC-9-20 an unknown route gives a 404 envelope', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
