import { describe, expect, it } from 'vitest';
import { NotificationOutbox } from '../notifications/types';

const payload = { to: ['a@example.com'], subject: 'Hello', text: 'Body' };
const T0 = new Date('2026-10-29T10:00:00.000Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);

/**
 * Behaviour every outbox must have: the in-memory outbox today, the SQL outbox later
 * (issue #6 / #41). Call it from a test file with a factory that returns a fresh, empty outbox.
 */
export function describeOutboxContract(
  name: string,
  create: () => Promise<NotificationOutbox>,
): void {
  describe(`notification outbox contract: ${name}`, () => {
    it('a new item is pending, due now, with zero attempts', async () => {
      const outbox = await create();
      const item = await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      expect(item).toMatchObject({
        id: 'i1',
        status: 'pending',
        attempts: 0,
        lockedUntil: null,
        sentAt: null,
      });
      expect(item.nextAttemptAt).toBe(T0.toISOString());
      expect(await outbox.get('i1')).toMatchObject({ id: 'i1', status: 'pending' });
      expect(await outbox.get('unknown')).toBeNull();
    });

    it('the same dedupeKey returns the existing item instead of creating a second one', async () => {
      const outbox = await create();
      const first = await outbox.enqueue({
        id: 'i1',
        channel: 'email',
        payload,
        dedupeKey: 'leave:1:approved',
        now: T0,
      });
      const second = await outbox.enqueue({
        id: 'i2',
        channel: 'email',
        payload,
        dedupeKey: 'leave:1:approved',
        now: T0,
      });
      expect(second.id).toBe(first.id);
      expect(await outbox.get('i2')).toBeNull();
      expect(await outbox.claimDue(10, T0, 60_000)).toHaveLength(1);
    });

    it('items without a dedupeKey are never merged', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      await outbox.enqueue({ id: 'i2', channel: 'email', payload, now: T0 });
      expect(await outbox.claimDue(10, T0, 60_000)).toHaveLength(2);
    });

    it('claiming marks items processing, locks them and counts the attempt', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      const [claimed] = await outbox.claimDue(10, T0, 60_000);
      expect(claimed).toMatchObject({ id: 'i1', status: 'processing', attempts: 1 });
      expect(claimed?.lockedUntil).toBe(plus(60_000).toISOString());
    });

    it('an item that is locked cannot be claimed again until the lock expires (crash recovery)', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      await outbox.claimDue(10, T0, 60_000);
      expect(await outbox.claimDue(10, plus(30_000), 60_000)).toHaveLength(0);
      const reclaimed = await outbox.claimDue(10, plus(60_001), 60_000);
      expect(reclaimed).toHaveLength(1);
      expect(reclaimed[0]?.attempts).toBe(2);
    });

    it('two workers claiming at the same moment never get the same item', async () => {
      const outbox = await create();
      for (let i = 0; i < 6; i++) {
        await outbox.enqueue({ id: `i${i}`, channel: 'email', payload, now: T0 });
      }
      const [a, b] = await Promise.all([
        outbox.claimDue(4, T0, 60_000),
        outbox.claimDue(4, T0, 60_000),
      ]);
      const ids = [...a, ...b].map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(6);
    });

    it('only items that are due are claimed, oldest first, up to the limit', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'later', channel: 'email', payload, now: plus(10_000) });
      await outbox.enqueue({ id: 'first', channel: 'email', payload, now: T0 });
      await outbox.enqueue({ id: 'second', channel: 'email', payload, now: plus(1_000) });
      expect((await outbox.claimDue(1, plus(2_000), 60_000)).map((i) => i.id)).toEqual(['first']);
      expect((await outbox.claimDue(10, plus(2_000), 60_000)).map((i) => i.id)).toEqual(['second']);
    });

    it('markSent finishes an item for good', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      await outbox.claimDue(10, T0, 60_000);
      await outbox.markSent('i1', plus(5));
      expect(await outbox.get('i1')).toMatchObject({
        status: 'sent',
        lockedUntil: null,
        sentAt: plus(5).toISOString(),
      });
      expect(await outbox.claimDue(10, plus(999_999_999), 60_000)).toHaveLength(0);
    });

    it('markFailed with a next time schedules a retry and keeps the error', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      await outbox.claimDue(10, T0, 60_000);
      await outbox.markFailed('i1', { error: 'boom', nextAttemptAt: plus(30_000) });
      expect(await outbox.get('i1')).toMatchObject({
        status: 'pending',
        lastError: 'boom',
        lockedUntil: null,
      });
      expect(await outbox.claimDue(10, plus(29_999), 60_000)).toHaveLength(0);
      expect(await outbox.claimDue(10, plus(30_000), 60_000)).toHaveLength(1);
    });

    it('markFailed without a next time gives up (dead) and the item is never claimed again', async () => {
      const outbox = await create();
      await outbox.enqueue({ id: 'i1', channel: 'email', payload, now: T0 });
      await outbox.claimDue(10, T0, 60_000);
      await outbox.markFailed('i1', { error: 'final', nextAttemptAt: null });
      expect(await outbox.get('i1')).toMatchObject({ status: 'dead', lastError: 'final' });
      expect(await outbox.claimDue(10, plus(999_999_999), 60_000)).toHaveLength(0);
    });

    it('the stored payload is a copy: changing the original afterwards changes nothing', async () => {
      const outbox = await create();
      const original = { to: ['a@example.com'], subject: 'Hello', text: 'Body' };
      await outbox.enqueue({ id: 'i1', channel: 'email', payload: original, now: T0 });
      original.subject = 'CHANGED';
      expect((await outbox.get('i1'))?.payload.subject).toBe('Hello');
    });
  });
}
