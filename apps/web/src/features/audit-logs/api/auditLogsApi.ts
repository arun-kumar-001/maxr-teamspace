import { apiFetch } from '../../../api/client';
import type {
  AuditLogItem,
  AuditLogListResponse,
  AuditLogQuery,
  BasicCompanySettings,
} from '../types';

export class AuditLogsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'AUDIT_LOG_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'AuditLogsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
}

export function buildAuditLogQueryString(query: AuditLogQuery): string {
  const searchParams = new URLSearchParams();

  if (query.page) {
    searchParams.set('page', String(query.page));
  }
  if (query.pageSize) {
    searchParams.set('pageSize', String(query.pageSize));
  }
  if (query.sortOrder) {
    searchParams.set('sortOrder', query.sortOrder);
  }
  if (query.actorId && query.actorId.trim()) {
    searchParams.set('actorId', query.actorId.trim());
  }

  // The backend rejects requests if both action and module are sent
  if (query.action && query.action.trim()) {
    searchParams.set('action', query.action.trim());
  } else if (query.module && query.module.trim()) {
    searchParams.set('module', query.module.trim());
  }

  if (query.entityType && query.entityType.trim()) {
    searchParams.set('entityType', query.entityType.trim());
  }
  if (query.entityId && query.entityId.trim()) {
    searchParams.set('entityId', query.entityId.trim());
  }
  if (query.outcome) {
    searchParams.set('outcome', query.outcome);
  }
  if (query.from && query.from.trim()) {
    searchParams.set('from', query.from.trim());
  }
  if (query.to && query.to.trim()) {
    searchParams.set('to', query.to.trim());
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function getAuditLogs(query: AuditLogQuery): Promise<AuditLogListResponse> {
  const qs = buildAuditLogQueryString(query);
  const response = await apiFetch(`/api/v1/audit-logs${qs}`);

  if (!response.ok) {
    let errorData: ApiEnvelope<AuditLogItem[]>['error'];
    try {
      const json = (await response.json()) as ApiEnvelope<AuditLogItem[]>;
      errorData = json.error;
    } catch {
      // Non-json response
    }
    throw new AuditLogsApiError(
      errorData?.message || `Failed to fetch audit logs (status ${response.status})`,
      response.status,
      errorData?.code || 'FETCH_AUDIT_LOGS_FAILED',
      errorData?.details,
      errorData?.requestId,
    );
  }

  const json = (await response.json()) as {
    data: AuditLogItem[];
    meta: { page: number; pageSize: number; total: number };
  };

  return {
    data: json.data || [],
    meta: json.meta || { page: query.page, pageSize: query.pageSize, total: 0 },
  };
}

export async function getBasicSettings(): Promise<BasicCompanySettings | null> {
  try {
    const response = await apiFetch('/api/v1/settings/basic');
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { data: BasicCompanySettings };
    return json.data;
  } catch {
    return null;
  }
}

