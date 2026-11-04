export type AuditOutcome = 'success' | 'denied' | 'failure';

export interface AuditLogActor {
  id: string;
  name: string | null;
  role: string | null;
}

export interface AuditLogItem extends Record<string, unknown> {
  id: string;
  occurredAt: string;
  action: string;
  outcome: AuditOutcome;
  actor: AuditLogActor | null;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  outcome?: AuditOutcome;
  from?: string;
  to?: string;
}

export interface AuditLogQuery extends AuditLogFilters {
  page: number;
  pageSize: number;
  sortOrder: 'asc' | 'desc';
}

export interface AuditLogPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface AuditLogListResponse {
  data: AuditLogItem[];
  meta: AuditLogPaginationMeta;
}

export interface BasicCompanySettings {
  companyName: string;
  timezone: string;
  workWeek?: {
    start: string;
    end: string;
    days: string[];
  };
}
