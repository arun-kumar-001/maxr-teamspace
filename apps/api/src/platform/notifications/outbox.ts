import { NewOutboxItem, NotificationOutbox, OutboxItem } from './types';

/** Reference implementation with the exact claim/lock/dedupe semantics the SQL outbox must have. */
export class InMemoryNotificationOutbox implements NotificationOutbox {
  private readonly items = new Map<string, OutboxItem>();
  private readonly byDedupeKey = new Map<string, string>();

  async enqueue(input: NewOutboxItem): Promise<OutboxItem> {
    if (input.dedupeKey) {
      const existingId = this.byDedupeKey.get(input.dedupeKey);
      const existing = existingId ? this.items.get(existingId) : undefined;
      if (existing) {
        return { ...existing };
      }
    }
    const created = input.now.toISOString();
    const item: OutboxItem = {
      id: input.id,
      channel: input.channel,
      payload: structuredClone(input.payload),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: created,
      lockedUntil: null,
      lastError: null,
      dedupeKey: input.dedupeKey ?? null,
      createdAt: created,
      sentAt: null,
    };
    this.items.set(item.id, item);
    if (input.dedupeKey) {
      this.byDedupeKey.set(input.dedupeKey, item.id);
    }
    return { ...item };
  }

  async claimDue(limit: number, now: Date, lockMs: number): Promise<OutboxItem[]> {
    const nowMs = now.getTime();
    const due = [...this.items.values()]
      .filter((item) => {
        if (item.status === 'pending') {
          return Date.parse(item.nextAttemptAt) <= nowMs;
        }
        // A worker that crashed while sending leaves a lock that expires; the item is then reclaimed.
        return (
          item.status === 'processing' &&
          item.lockedUntil !== null &&
          Date.parse(item.lockedUntil) <= nowMs
        );
      })
      .sort(
        (a, b) =>
          Date.parse(a.nextAttemptAt) - Date.parse(b.nextAttemptAt) ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .slice(0, limit);

    for (const item of due) {
      item.status = 'processing';
      item.attempts += 1;
      item.lockedUntil = new Date(nowMs + lockMs).toISOString();
    }
    return due.map((item) => structuredClone(item));
  }

  async markSent(id: string, now: Date): Promise<void> {
    const item = this.require(id);
    item.status = 'sent';
    item.sentAt = now.toISOString();
    item.lockedUntil = null;
    item.lastError = null;
  }

  async markFailed(
    id: string,
    failure: { error: string; nextAttemptAt: Date | null },
  ): Promise<void> {
    const item = this.require(id);
    item.lastError = failure.error;
    item.lockedUntil = null;
    if (failure.nextAttemptAt === null) {
      item.status = 'dead';
    } else {
      item.status = 'pending';
      item.nextAttemptAt = failure.nextAttemptAt.toISOString();
    }
  }

  async get(id: string): Promise<OutboxItem | null> {
    const item = this.items.get(id);
    return item ? structuredClone(item) : null;
  }

  private require(id: string): OutboxItem {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Outbox item ${id} does not exist`);
    }
    return item;
  }
}
