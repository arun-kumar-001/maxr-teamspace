import type { AuditOutcome } from '../../platform/audit/types';

export interface AuditLogActor {
  id: string;
  /** The user's employee name, when the account still exists. */
  name: string | null;
  role: string | null;
}

/** One row of the audit trail as the Admin sees it. */
export interface AuditLogItem {
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
  /** Exact `module.verb`. */
  action?: string;
  /** Every action of one module, for example `leave` matches `leave.approve`. */
  module?: string;
  entityType?: string;
  entityId?: string;
  outcome?: AuditOutcome;
  /** Inclusive start (UTC). */
  from?: string;
  /** Exclusive end (UTC). */
  to?: string;
}

export interface AuditLogFindManyParams extends AuditLogFilters {
  offset: number;
  limit: number;
  sortOrder: 'asc' | 'desc';
}
