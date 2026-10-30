import { PaginatedResponse } from '@maxr/shared';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import { redact } from '../../logging/redact';
import { IAuditLogRepository } from './audit-log.repository';
import { AuditLogFilters, AuditLogItem } from './audit-log.types';

export interface AuditLogQuery extends AuditLogFilters {
  page: number;
  pageSize: number;
  sortOrder: 'asc' | 'desc';
}

const redactJson = (value: Record<string, unknown> | null): Record<string, unknown> | null =>
  value === null ? null : (redact(value) as Record<string, unknown>);

export class AuditLogService {
  constructor(private readonly repository: IAuditLogRepository) {}

  async list(query: AuditLogQuery): Promise<PaginatedResponse<AuditLogItem>> {
    const { page, pageSize, ...rest } = query;
    const { items, total } = await this.repository.findMany({
      ...rest,
      ...toOffsetLimit({ page, pageSize }),
    });
    // Entries are redacted when written; do it again on the way out so a value that slipped in
    // through an old row or a direct insert still never reaches a screen.
    const safe = items.map((item) => ({
      ...item,
      changes: redactJson(item.changes),
      metadata: redactJson(item.metadata),
    }));
    return buildPage(safe, total, { page, pageSize });
  }
}
