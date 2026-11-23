import { Pool, PoolClient } from 'pg';
import { AuditEntry, AuditStore, AuditWriteOptions } from './types';

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

function isQueryable(target: unknown): target is Queryable {
  return (
    typeof target === 'object' &&
    target !== null &&
    'query' in target &&
    typeof (target as { query: unknown }).query === 'function'
  );
}

/**
 * PostgreSQL durable implementation of `AuditStore`.
 * Writes to the append-only `audit_logs` table.
 * Participates in the caller's transaction if `options.transaction` is provided.
 */
export class SqlAuditStore implements AuditStore {
  constructor(private readonly pool: Pool) {}

  async append(entry: AuditEntry, options?: AuditWriteOptions): Promise<void> {
    const executor: Queryable =
      options?.transaction && isQueryable(options.transaction)
        ? (options.transaction as PoolClient)
        : this.pool;

    const sql = `
      INSERT INTO audit_logs (
        id, occurred_at, action, outcome, actor_id, actor_role,
        entity_type, entity_id, request_id, changes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;

    const values = [
      entry.id,
      entry.occurredAt,
      entry.action,
      entry.outcome,
      entry.actorId ?? null,
      entry.actorRole ?? null,
      entry.entityType,
      entry.entityId ?? null,
      entry.requestId ?? null,
      entry.changes ? JSON.stringify(entry.changes) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ];

    await executor.query(sql, values);
  }

  /**
   * Reads an audit record by ID.
   * Useful for integration test verification and audit inspections.
   */
  async findById(id: string): Promise<AuditEntry | null> {
    const sql = `
      SELECT id, occurred_at, action, outcome, actor_id, actor_role,
             entity_type, entity_id, request_id, changes, metadata
      FROM audit_logs
      WHERE id = $1;
    `;

    const res = await this.pool.query(sql, [id]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0] as {
      id: string;
      occurred_at: Date;
      action: string;
      outcome: 'success' | 'denied' | 'failure';
      actor_id: string | null;
      actor_role: string | null;
      entity_type: string;
      entity_id: string | null;
      request_id: string | null;
      changes: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    };

    return {
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      action: row.action,
      outcome: row.outcome,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      actorId: row.actor_id ?? undefined,
      actorRole: row.actor_role ?? undefined,
      requestId: row.request_id ?? undefined,
      changes: row.changes ?? undefined,
      metadata: row.metadata ?? undefined,
    };
  }
}
