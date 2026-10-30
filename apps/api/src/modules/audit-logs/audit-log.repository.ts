import type { Pool } from 'pg';
import { AuditLogFindManyParams, AuditLogItem } from './audit-log.types';

/** Read-only on purpose: the audit trail has no way to be changed through this module. */
export interface IAuditLogRepository {
  findMany(params: AuditLogFindManyParams): Promise<{ items: AuditLogItem[]; total: number }>;
}

interface AuditRow {
  id: string;
  occurred_at: Date | string;
  action: string;
  outcome: AuditLogItem['outcome'];
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

const toItem = (row: AuditRow): AuditLogItem => ({
  id: row.id,
  occurredAt: new Date(row.occurred_at).toISOString(),
  action: row.action,
  outcome: row.outcome,
  actor: row.actor_id ? { id: row.actor_id, name: row.actor_name, role: row.actor_role } : null,
  entityType: row.entity_type,
  entityId: row.entity_id,
  requestId: row.request_id,
  changes: row.changes,
  metadata: row.metadata,
});

/** `_` and `%` are wildcards in LIKE; module names contain `_` (for example `audit_logs`). */
const escapeLike = (value: string): string => value.replace(/([\\%_])/g, '\\$1');

export class PgAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findMany(
    params: AuditLogFindManyParams,
  ): Promise<{ items: AuditLogItem[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    if (params.actorId) add('a.actor_id = ?', params.actorId);
    if (params.action) add('a.action = ?', params.action);
    if (params.module) add(`a.action LIKE ? ESCAPE '\\'`, `${escapeLike(params.module)}.%`);
    if (params.entityType) add('a.entity_type = ?', params.entityType);
    if (params.entityId) add('a.entity_id = ?', params.entityId);
    if (params.outcome) add('a.outcome = ?', params.outcome);
    if (params.from) add('a.occurred_at >= ?', params.from);
    if (params.to) add('a.occurred_at < ?', params.to);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const direction = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const count = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM audit_logs a ${where}`,
      values,
    );
    const paging = [...values, params.limit, params.offset];
    const res = await this.getPool().query<AuditRow>(
      `SELECT a.id, a.occurred_at, a.action, a.outcome, a.actor_id, a.actor_role,
              NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), '') AS actor_name,
              a.entity_type, a.entity_id, a.request_id, a.changes, a.metadata
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         LEFT JOIN employees e ON e.id = u.employee_id
         ${where}
        ORDER BY a.occurred_at ${direction}, a.id ${direction}
        LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
      paging,
    );
    return { items: res.rows.map(toItem), total: count.rows[0]?.count ?? 0 };
  }
}
