import { apiFetch } from '../../../api/client';
import type {
  CreateExpenseClaimPayload,
  ExpenseCategory,
  ExpenseClaim,
  ListExpenseClaimsParams,
  PaginatedResult,
} from '../types';

export class ExpensesApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code = 'EXPENSES_API_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ExpensesApiError';
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
    pageCount: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
}

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let errorData: ApiEnvelope<T>['error'];
    try {
      const json = (await response.json()) as ApiEnvelope<T>;
      errorData = json.error;
    } catch {
      // response wasn't json
    }
    throw new ExpensesApiError(
      errorData?.message || `${fallbackMessage} (${response.status})`,
      response.status,
      errorData?.code || 'EXPENSES_ERROR',
      errorData?.details,
      errorData?.requestId,
    );
  }
  const json = (await response.json()) as T;
  return json;
}

export function buildQueryParams(params?: ListExpenseClaimsParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.status) sp.set('status', params.status);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.employeeId) sp.set('employeeId', params.employeeId);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function listCategories(): Promise<ExpenseCategory[]> {
  const res = await apiFetch('/api/v1/expense-categories');
  const json = await handleResponse<ApiEnvelope<ExpenseCategory[]>>(
    res,
    'Failed to load expense categories',
  );
  return json.data;
}

export async function listClaims(
  params?: ListExpenseClaimsParams,
): Promise<PaginatedResult<ExpenseClaim>> {
  const qs = buildQueryParams(params);
  const res = await apiFetch(`/api/v1/expense-claims${qs}`);
  const json = await handleResponse<PaginatedResult<ExpenseClaim>>(
    res,
    'Failed to load expense claims',
  );
  return json;
}

export async function listMyClaims(
  params?: ListExpenseClaimsParams,
): Promise<PaginatedResult<ExpenseClaim>> {
  const qs = buildQueryParams(params);
  const res = await apiFetch(`/api/v1/expense-claims/mine${qs}`);
  const json = await handleResponse<PaginatedResult<ExpenseClaim>>(
    res,
    'Failed to load your expense claims',
  );
  return json;
}

export async function getClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiFetch(`/api/v1/expense-claims/${id}`);
  const json = await handleResponse<ApiEnvelope<ExpenseClaim>>(
    res,
    'Failed to load expense claim details',
  );
  return json.data;
}

export async function submitClaim(payload: CreateExpenseClaimPayload): Promise<ExpenseClaim> {
  const res = await apiFetch('/api/v1/expense-claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<ApiEnvelope<ExpenseClaim>>(
    res,
    'Failed to submit expense claim',
  );
  return json.data;
}

export async function cancelClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiFetch(`/api/v1/expense-claims/${id}/cancel`, {
    method: 'POST',
  });
  const json = await handleResponse<ApiEnvelope<ExpenseClaim>>(
    res,
    'Failed to cancel expense claim',
  );
  return json.data;
}

export async function reimburseClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiFetch(`/api/v1/expense-claims/${id}/reimburse`, {
    method: 'POST',
  });
  const json = await handleResponse<ApiEnvelope<ExpenseClaim>>(
    res,
    'Failed to reimburse expense claim',
  );
  return json.data;
}

export async function getReceiptDownloadLink(
  id: string,
): Promise<{ url: string; expiresAt: string }> {
  const res = await apiFetch(`/api/v1/expense-claims/${id}/receipt`);
  const json = await handleResponse<ApiEnvelope<{ url: string; expiresAt: string }>>(
    res,
    'Failed to retrieve receipt download link',
  );
  return json.data;
}
