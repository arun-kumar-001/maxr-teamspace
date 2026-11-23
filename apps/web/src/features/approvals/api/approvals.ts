import { apiFetch } from '../../../api/client';
import type { Approval, ApprovalQuery, PaginatedApprovalsResponse } from '../types';

export class ApprovalsApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'APPROVALS_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApprovalsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorInfo = payload?.error;
    throw new ApprovalsApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'APPROVALS_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

function buildQueryString(query?: ApprovalQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.subjectType) params.set('subjectType', query.subjectType);
  if (query.awaitingMyDecision !== undefined) {
    params.set('awaitingMyDecision', String(query.awaitingMyDecision));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * List approvals with optional filtering by status, subject type, and awaiting decision.
 */
export async function fetchApprovals(query?: ApprovalQuery): Promise<PaginatedApprovalsResponse> {
  const qs = buildQueryString(query);
  const res = await apiFetch(`/api/v1/approvals${qs}`);
  return handleResponse<PaginatedApprovalsResponse>(res);
}

/**
 * Fetch a single approval record by ID.
 */
export async function fetchApproval(id: string): Promise<Approval> {
  const res = await apiFetch(`/api/v1/approvals/${encodeURIComponent(id)}`);
  const body = await handleResponse<{ data: Approval }>(res);
  return body.data;
}

/**
 * Approve a pending approval stage. Comment is optional.
 */
export async function approveRequest(id: string, comment?: string): Promise<Approval> {
  const res = await apiFetch(`/api/v1/approvals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment?.trim() || undefined }),
  });
  const body = await handleResponse<{ data: Approval }>(res);
  return body.data;
}

/**
 * Reject a pending approval stage. Comment is required.
 */
export async function rejectRequest(id: string, comment: string): Promise<Approval> {
  const res = await apiFetch(`/api/v1/approvals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment.trim() }),
  });
  const body = await handleResponse<{ data: Approval }>(res);
  return body.data;
}
