import { describe, expect, it } from 'vitest';
import { captureLogger } from '../../test/helpers';
import { describeOutboxContract } from '../contracts/outbox.contract';
import { retryDelayMs } from './backoff';
import { FakeEmailAdapter } from './adapters/fake-email-adapter';
import { createOutboxDispatcher } from './dispatcher';
import { createNotificationService } from './notification-service';
import { InMemoryNotificationOutbox } from './outbox';

// TC-13-20 (outbox contract) ------------------------------------------------------------------
describeOutboxContract('in-memory', async () => new InMemoryNotificationOutbox());

const T0 = new Date('2026-10-29T10:00:00.000Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);
const message = {
  to: ['person@example.com'],
  subject: 'Leave approved',
  text: 'Your leave was approved.',
};

function setup(maxAttempts = 5) {
  const outbox = new InMemoryNotificationOutbox();
  const email = new FakeEmailAdapter();
  const log = captureLogger();
  let n = 0;
  const service = createNotificationService({
    outbox,
    logger: log.logger,
    now: () => T0,
    newId: () => `n${++n}`,
  });
  const dispatcher = createOutboxDispatcher({ outbox, email, logger: log.logger, maxAttempts });
  return { outbox, email, log, service, dispatcher };
}

describe('notification service (TC-13-11, TC-13-12)', () => {
  it('TC-13-11 enqueueEmail validates and creates a pending outbox item', async () => {
    const { service, outbox } = setup();
    const item = await service.enqueueEmail(message);
    expect(item).toMatchObject({
      id: 'n1',
      channel: 'email',
      status: 'pending',
      attempts: 0,
      payload: message,
    });
    expect(await outbox.get('n1')).not.toBeNull();
  });

  it('TC-13-11 the same dedupeKey queues exactly one email, even when the caller retries', async () => {
    const { service, dispatcher, email } = setup();
    const a = await service.enqueueEmail({ ...message, dedupeKey: 'leave:7:approved' });
    const b = await service.enqueueEmail({ ...message, dedupeKey: 'leave:7:approved' });
    expect(b.id).toBe(a.id);
    await dispatcher.runOnce(T0);
    expect(email.sent).toHaveLength(1);
  });

  it.each([
    ['a line break in the subject', { subject: 'Hi\nBcc: x@example.com' }],
    ['a line break in an address', { to: ['a@example.com\r\nBcc: x@example.com'] }],
    ['a malformed address', { to: ['nope'] }],
    ['an address list in one string', { to: ['a@example.com,b@example.com'] }],
    ['an angle-bracket address', { to: ['Evil <a@example.com>'] }],
    ['51 recipients', { to: Array.from({ length: 51 }, (_, i) => `u${i}@example.com`) }],
    ['no recipients', { to: [] }],
    ['an empty subject', { subject: '' }],
    ['a too-long subject', { subject: 'x'.repeat(201) }],
    ['an oversize body', { text: 'x'.repeat(100_001) }],
  ])('TC-13-12 rejects %s with a 400 and queues nothing', async (_label, patch) => {
    const { service, outbox } = setup();
    await expect(service.enqueueEmail({ ...message, ...patch })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(await outbox.get('n1')).toBeNull();
  });

  it('accepts 50 recipients (the limit) and an html part', async () => {
    const { service } = setup();
    const to = Array.from({ length: 50 }, (_, i) => `u${i}@example.com`);
    await expect(
      service.enqueueEmail({ ...message, to, html: '<p>hi</p>' }),
    ).resolves.toMatchObject({ id: 'n1' });
  });
});

describe('retry delay (TC-13-14)', () => {
  it('doubles from 30 s and is capped at one hour', () => {
    expect([1, 2, 3, 4, 5].map((n) => retryDelayMs(n))).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000,
    ]);
    expect(retryDelayMs(10)).toBe(3_600_000);
    expect(retryDelayMs(1000)).toBe(3_600_000);
    expect(retryDelayMs(0)).toBe(30_000);
  });
});

describe('outbox dispatcher (TC-13-13 .. TC-13-16)', () => {
  it('TC-13-13 sends what is due and marks it sent; sends nothing twice', async () => {
    const { service, dispatcher, email, outbox } = setup();
    await service.enqueueEmail(message);
    expect(await dispatcher.runOnce(T0)).toEqual({ claimed: 1, sent: 1, retried: 0, dead: 0 });
    expect(email.sent).toHaveLength(1);
    expect((await outbox.get('n1'))?.status).toBe('sent');
    expect(await dispatcher.runOnce(plus(1_000_000))).toEqual({
      claimed: 0,
      sent: 0,
      retried: 0,
      dead: 0,
    });
    expect(email.sent).toHaveLength(1);
  });

  it('TC-13-13 does not send an item that is not due yet', async () => {
    const { outbox, dispatcher, email } = setup();
    await outbox.enqueue({ id: 'future', channel: 'email', payload: message, now: plus(60_000) });
    expect((await dispatcher.runOnce(T0)).claimed).toBe(0);
    expect((await dispatcher.runOnce(plus(60_000))).sent).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it('TC-13-14 a failure is retried with growing delays and then succeeds', async () => {
    const { service, dispatcher, email, outbox } = setup();
    await service.enqueueEmail(message);
    email.failNext(2);

    expect(await dispatcher.runOnce(T0)).toMatchObject({ retried: 1, sent: 0 });
    let item = await outbox.get('n1');
    expect(item).toMatchObject({ status: 'pending', attempts: 1 });
    expect(item?.nextAttemptAt).toBe(plus(30_000).toISOString());

    expect((await dispatcher.runOnce(plus(29_000))).claimed).toBe(0); // too early
    expect(await dispatcher.runOnce(plus(30_000))).toMatchObject({ retried: 1 });
    item = await outbox.get('n1');
    expect(item?.nextAttemptAt).toBe(plus(30_000 + 60_000).toISOString());

    expect(await dispatcher.runOnce(plus(90_000))).toMatchObject({ sent: 1 });
    expect(await outbox.get('n1')).toMatchObject({ status: 'sent', attempts: 3, lastError: null });
  });

  it('TC-13-14 after the maximum attempts the item is dead and never tried again', async () => {
    const { service, dispatcher, email, outbox } = setup(3);
    await service.enqueueEmail(message);
    email.failNext(99);
    let now = T0;
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(await dispatcher.runOnce(now));
      now = plus(now.getTime() - T0.getTime() + 4_000_000);
    }
    expect(outcomes.map((o) => [o.retried, o.dead])).toEqual([
      [1, 0],
      [1, 0],
      [0, 1],
    ]);
    expect(await outbox.get('n1')).toMatchObject({ status: 'dead', attempts: 3 });
    expect((await dispatcher.runOnce(plus(999_999_999))).claimed).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it('TC-13-15 two dispatchers running at once never send the same item twice', async () => {
    const { service, outbox, email, log } = setup();
    for (let i = 0; i < 8; i++) {
      await service.enqueueEmail({ ...message, subject: `Mail ${i}` });
    }
    const other = createOutboxDispatcher({
      outbox,
      email,
      logger: log.logger,
      maxAttempts: 5,
      batchSize: 3,
    });
    const first = createOutboxDispatcher({
      outbox,
      email,
      logger: log.logger,
      maxAttempts: 5,
      batchSize: 5,
    });
    await Promise.all([first.runOnce(T0), other.runOnce(T0)]);
    await Promise.all([first.runOnce(T0), other.runOnce(T0)]);
    const subjects = email.sent.map((m) => m.subject);
    expect(subjects).toHaveLength(8);
    expect(new Set(subjects).size).toBe(8);
  });

  it('TC-13-15 an item left locked by a crashed worker is picked up again after the lock expires', async () => {
    const { outbox, dispatcher, email } = setup();
    await outbox.enqueue({ id: 'stuck', channel: 'email', payload: message, now: T0 });
    await outbox.claimDue(10, T0, 60_000); // a worker claims it, then crashes
    expect((await dispatcher.runOnce(plus(30_000))).claimed).toBe(0);
    expect((await dispatcher.runOnce(plus(61_000))).sent).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it('TC-13-16 logs never contain the recipient, the subject or the body', async () => {
    const { service, dispatcher, email, log } = setup();
    const secret = {
      to: ['maya.private@example.com'],
      subject: 'Your salary revision',
      text: 'Body with salary details',
    };
    await service.enqueueEmail(secret);
    email.failNext(1, 'rejected recipient maya.private@example.com password=hunter2');
    await dispatcher.runOnce(T0);
    await dispatcher.runOnce(plus(30_000));
    const text = log.lines.join('\n');
    expect(text).toContain('notification queued');
    expect(text).toContain('notification failed');
    expect(text).toContain('notification sent');
    expect(text).not.toMatch(/maya\.private|salary|hunter2/);
  });

  it('TC-13-16 the stored error is scrubbed of secrets and bounded in length', async () => {
    const { service, dispatcher, email, outbox } = setup();
    await service.enqueueEmail(message);
    email.failNext(1, `auth failed password=hunter2 ${'x'.repeat(1000)}`);
    await dispatcher.runOnce(T0);
    const item = await outbox.get('n1');
    expect(item?.lastError).not.toContain('hunter2');
    expect(item?.lastError?.length).toBeLessThanOrEqual(300);
  });

  it('start() runs the dispatcher on a timer and stop() ends it', async () => {
    const { outbox, dispatcher, email, log } = setup();
    // Real timers need real time: queue the item as "a second ago".
    const service = createNotificationService({
      outbox,
      logger: log.logger,
      now: () => new Date(Date.now() - 1000),
    });
    await service.enqueueEmail(message);
    dispatcher.start(10);
    dispatcher.start(10); // starting twice does not start two timers
    await new Promise((r) => setTimeout(r, 120));
    dispatcher.stop();
    expect(email.sent).toHaveLength(1);
    await service.enqueueEmail({ ...message, subject: 'after stop' });
    await new Promise((r) => setTimeout(r, 60));
    expect(email.sent).toHaveLength(1);
  });
});
