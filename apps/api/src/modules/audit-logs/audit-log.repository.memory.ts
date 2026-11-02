import { IAuditLogRepository } from './audit-log.repository';
import { AuditLogFindManyParams, AuditLogItem } from './audit-log.types';

/** In-memory audit trail for unit and HTTP tests (not shipped in the build). */
export class MemoryAuditLogRepository implements IAuditLogRepository {
  constructor(public rows: AuditLogItem[] = []) {}

  async findMany(p: AuditLogFindManyParams): Promise<{ items: AuditLogItem[]; total: number }> {
    const matching = this.rows.filter(
      (r) =>
        (!p.actorId || r.actor?.id === p.actorId) &&
        (!p.action || r.action === p.action) &&
        (!p.module || r.action.startsWith(`${p.module}.`)) &&
        (!p.entityType || r.entityType === p.entityType) &&
        (!p.entityId || r.entityId === p.entityId) &&
        (!p.outcome || r.outcome === p.outcome) &&
        (!p.from || r.occurredAt >= new Date(p.from).toISOString()) &&
        (!p.to || r.occurredAt < new Date(p.to).toISOString()),
    );
    const direction = p.sortOrder === 'asc' ? 1 : -1;
    matching.sort(
      (a, b) =>
        (a.occurredAt === b.occurredAt
          ? a.id.localeCompare(b.id)
          : a.occurredAt.localeCompare(b.occurredAt)) * direction,
    );
    return { items: matching.slice(p.offset, p.offset + p.limit), total: matching.length };
  }
}
