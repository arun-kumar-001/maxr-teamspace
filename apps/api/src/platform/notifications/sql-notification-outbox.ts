import { Pool } from 'pg';
import { EmailMessage, NewOutboxItem, NotificationOutbox, OutboxItem, OutboxStatus } from './types';

interface OutboxRow {
  id: string;
  channel: string;
  payload: EmailMessage;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: Date;
  locked_until: Date | null;
  last_error: string | null;
  dedupe_key: string | null;
  created_at: Date;
  sent_at: Date | null;
}

function mapRowToOutboxItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    channel: 'email',
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at.toISOString(),
    lockedUntil: row.locked_until ? row.locked_until.toISOString() : null,
    lastError: row.last_error,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
  };
}

/**
 * PostgreSQL durable implementation of `NotificationOutbox`.
 * Uses table `notification_outbox` with `FOR UPDATE SKIP LOCKED` for concurrent safe claims.
 */
export class SqlNotificationOutbox implements NotificationOutbox {
  constructor(private readonly pool: Pool) {}

  async enqueue(item: NewOutboxItem): Promise<OutboxItem> {
    if (item.dedupeKey) {
      // First check if an item with this dedupe_key already exists
      const existing = await this.pool.query<OutboxRow>(
        'SELECT * FROM notification_outbox WHERE dedupe_key = $1',
        [item.dedupeKey],
      );
      if (existing.rows.length > 0 && existing.rows[0]) {
        return mapRowToOutboxItem(existing.rows[0]);
      }

      // Try insert with ON CONFLICT (dedupe_key) DO NOTHING
      const insertSql = `
        INSERT INTO notification_outbox (
          id, channel, payload, status, attempts, next_attempt_at, dedupe_key, created_at
        ) VALUES ($1, $2, $3, 'pending', 0, $4, $5, $4)
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        RETURNING *;
      `;
      const res = await this.pool.query<OutboxRow>(insertSql, [
        item.id,
        item.channel,
        JSON.stringify(item.payload),
        item.now,
        item.dedupeKey,
      ]);

      if (res.rows.length > 0 && res.rows[0]) {
        return mapRowToOutboxItem(res.rows[0]);
      }

      // If race occurred and insert yielded no row, re-fetch existing
      const recheck = await this.pool.query<OutboxRow>(
        'SELECT * FROM notification_outbox WHERE dedupe_key = $1',
        [item.dedupeKey],
      );
      if (recheck.rows.length > 0 && recheck.rows[0]) {
        return mapRowToOutboxItem(recheck.rows[0]);
      }
    }

    // Normal enqueue without dedupe key
    const sql = `
      INSERT INTO notification_outbox (
        id, channel, payload, status, attempts, next_attempt_at, dedupe_key, created_at
      ) VALUES ($1, $2, $3, 'pending', 0, $4, $5, $4)
      RETURNING *;
    `;
    const res = await this.pool.query<OutboxRow>(sql, [
      item.id,
      item.channel,
      JSON.stringify(item.payload),
      item.now,
      item.dedupeKey ?? null,
    ]);

    if (!res.rows[0]) {
      throw new Error(`[SqlNotificationOutbox] Failed to insert outbox item: ${item.id}`);
    }
    return mapRowToOutboxItem(res.rows[0]);
  }

  async claimDue(limit: number, now: Date, lockMs: number): Promise<OutboxItem[]> {
    const lockedUntil = new Date(now.getTime() + lockMs);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Atomic claim using FOR UPDATE SKIP LOCKED
      const claimSql = `
        WITH due AS (
          SELECT id FROM notification_outbox
          WHERE (status = 'pending' AND next_attempt_at <= $1)
             OR (status = 'processing' AND locked_until IS NOT NULL AND locked_until <= $1)
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_outbox
        SET status = 'processing',
            attempts = attempts + 1,
            locked_until = $3
        WHERE id IN (SELECT id FROM due)
        RETURNING *;
      `;

      const res = await client.query<OutboxRow>(claimSql, [now, limit, lockedUntil]);
      await client.query('COMMIT');

      return res.rows.map(mapRowToOutboxItem);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async markSent(id: string, now: Date): Promise<void> {
    const sql = `
      UPDATE notification_outbox
      SET status = 'sent',
          sent_at = $2,
          locked_until = NULL
      WHERE id = $1;
    `;
    await this.pool.query(sql, [id, now]);
  }

  async markFailed(
    id: string,
    failure: { error: string; nextAttemptAt: Date | null },
  ): Promise<void> {
    if (failure.nextAttemptAt === null) {
      const sql = `
        UPDATE notification_outbox
        SET status = 'dead',
            last_error = $2,
            locked_until = NULL
        WHERE id = $1;
      `;
      await this.pool.query(sql, [id, failure.error]);
    } else {
      const sql = `
        UPDATE notification_outbox
        SET status = 'pending',
            next_attempt_at = $3,
            last_error = $2,
            locked_until = NULL
        WHERE id = $1;
      `;
      await this.pool.query(sql, [id, failure.error, failure.nextAttemptAt]);
    }
  }

  async get(id: string): Promise<OutboxItem | null> {
    const sql = 'SELECT * FROM notification_outbox WHERE id = $1;';
    const res = await this.pool.query<OutboxRow>(sql, [id]);
    if (res.rows.length === 0 || !res.rows[0]) {
      return null;
    }
    return mapRowToOutboxItem(res.rows[0]);
  }
}
