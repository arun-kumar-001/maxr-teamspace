import { testActor } from '../test/fixtures';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { asyncHandler } from './async-handler';
import { InMemoryIdempotencyStore, idempotent } from './idempotency';
import { makeApp, makeMiniApp } from '../test/helpers';

const KEY = 'order-key-0001';

function counterApp(options: { delayMs?: number; failFirst?: boolean } = {}) {
  const store = new InMemoryIdempotencyStore();
  let calls = 0;
  const mini = makeMiniApp((app) => {
    app.post(
      '/pay',
      // Test auth stand-in: the actor comes from a header.
      (req, _res, next) => {
        const user = req.header('x-test-user');
        if (user) req.actor = testActor(user);
        next();
      },
      idempotent({ store }),
      asyncHandler(async (req, res) => {
        calls += 1;
        if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
        if (options.failFirst && calls === 1) throw new Error('db down');
        res.status(201).json({ data: { n: calls, echo: req.body } });
      }),
    );
  });
  return { ...mini, store, calls: () => calls };
}

describe('idempotency (TC-9-09 .. TC-9-12)', () => {
  it('TC-9-09 same key and same body replays the stored response; the handler ran once', async () => {
    const t = counterApp();
    const first = await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    const second = await request(t.app)
      .post('/pay')
      .set('Idempotency-Key', KEY)
      .send({ amount: 5 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(t.calls()).toBe(1);
  });

  it('TC-9-09 a different key runs the handler again', async () => {
    const t = counterApp();
    await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    await request(t.app).post('/pay').set('Idempotency-Key', 'order-key-0002').send({ amount: 5 });
    expect(t.calls()).toBe(2);
  });

  it('TC-9-10 same key with a different body is 422 and the handler is not run again', async () => {
    const t = counterApp();
    await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    const res = await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 6 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(t.calls()).toBe(1);
  });

  it('TC-9-11 a concurrent duplicate gets 409 while the first is still running', async () => {
    const t = counterApp({ delayMs: 150 });
    const [a, b] = await Promise.all([
      request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 }),
      request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(t.calls()).toBe(1);
    // After it finishes, a retry replays the result.
    const retry = await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
  });

  it('TC-9-12 a missing key is 400 when required', async () => {
    const t = counterApp();
    const res = await request(t.app).post('/pay').send({ amount: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('header.Idempotency-Key');
    expect(t.calls()).toBe(0);
  });

  it.each(['short', 'has spaces in it', 'semi;colon-key-1', 'x'.repeat(129)])(
    'TC-9-12 rejects the malformed key %j',
    async (bad) => {
      const t = counterApp();
      const res = await request(t.app).post('/pay').set('Idempotency-Key', bad).send({});
      expect(res.status).toBe(400);
      expect(t.calls()).toBe(0);
    },
  );

  it('a key is optional when required is false', async () => {
    const store = new InMemoryIdempotencyStore();
    const { app } = makeMiniApp((a) => {
      a.post('/x', idempotent({ store, required: false }), (_req, res) =>
        res.status(201).json({ ok: 1 }),
      );
    });
    expect((await request(app).post('/x').send({})).status).toBe(201);
  });

  it('SECURITY: users cannot replay each other’s responses with the same key', async () => {
    const t = counterApp();
    const alice = await request(t.app)
      .post('/pay')
      .set('x-test-user', 'alice')
      .set('Idempotency-Key', KEY)
      .send({ amount: 5 });
    const bob = await request(t.app)
      .post('/pay')
      .set('x-test-user', 'bob')
      .set('Idempotency-Key', KEY)
      .send({ amount: 5 });
    expect(bob.headers['idempotent-replayed']).toBeUndefined();
    expect(bob.body.data.n).toBe(2);
    expect(alice.body.data.n).toBe(1);
    expect(t.calls()).toBe(2);
  });

  it('a 5xx result releases the key so the client can retry', async () => {
    const t = counterApp({ failFirst: true });
    const first = await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    expect(first.status).toBe(500);
    const retry = await request(t.app).post('/pay').set('Idempotency-Key', KEY).send({ amount: 5 });
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
    expect(t.calls()).toBe(2);
  });

  it('a client error (4xx) is stored and replayed', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const { app } = makeMiniApp((a) => {
      a.post('/x', idempotent({ store }), (_req, res) => {
        calls += 1;
        res.status(422).json({ error: { code: 'UNPROCESSABLE_ENTITY' } });
      });
    });
    await request(app).post('/x').set('Idempotency-Key', KEY).send({});
    const again = await request(app).post('/x').set('Idempotency-Key', KEY).send({});
    expect(again.status).toBe(422);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(calls).toBe(1);
  });

  it('entries expire after the TTL', async () => {
    let now = 1_000;
    const store = new InMemoryIdempotencyStore(() => now);
    expect(await store.begin('k', 'f', 100)).toBeNull();
    expect(await store.begin('k', 'f', 100)).not.toBeNull();
    now += 101;
    expect(await store.begin('k', 'f', 100)).toBeNull();
  });

  it('an aborted request frees the key', async () => {
    const store = new InMemoryIdempotencyStore();
    const app = express();
    app.post('/slow', idempotent({ store, required: false }), () => {
      /* never answers: simulates a client that disconnects */
    });
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const controller = new AbortController();
    const pending = fetch(`http://127.0.0.1:${port}/slow`, {
      method: 'POST',
      headers: { 'Idempotency-Key': KEY, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    expect(store.size).toBe(1);
    controller.abort();
    await pending;
    await new Promise((r) => setTimeout(r, 100));
    expect(store.size).toBe(0);
    server.close();
  });
});

describe('sample module create is idempotent end to end', () => {
  it('creating twice with the same key yields one record', async () => {
    const { app } = makeApp();
    const a = await request(app)
      .post('/api/v1/templates')
      .set('Idempotency-Key', KEY)
      .send({ name: 'Once' });
    const b = await request(app)
      .post('/api/v1/templates')
      .set('Idempotency-Key', KEY)
      .send({ name: 'Once' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.data.id).toBe(a.body.data.id);
    const list = await request(app).get('/api/v1/templates');
    expect(list.body.meta.total).toBe(1);
  });
});
