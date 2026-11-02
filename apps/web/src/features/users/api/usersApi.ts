import { apiFetch } from '../../../api/client';
import type { Role } from '@maxr/shared';
import type {
  PermissionSummary,
  RoleSummary,
  UserAccount,
  UserListQuery,
  UserListResponse,
} from '../types';

export class UsersApiError extends Error {
  public readonly status: number;
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'UsersApiError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
  }
}

async function handleApiError(res: Response, defaultMessage: string): Promise<never> {
  let message = `${defaultMessage} (${res.status})`;
  let code: string | undefined;

  try {
    const errorJson = (await res.json()) as { error?: { message?: string; code?: string } };
    if (errorJson.error?.message) {
      message = errorJson.error.message;
    }
    code = errorJson.error?.code;
  } catch {
    // Response not JSON
  }

  throw new UsersApiError(res.status, message, code);
}

/**
 * Fetches paginated user accounts with filtering and sorting.
 * GET /api/v1/users
 */
export async function getUsers(query: Partial<UserListQuery> = {}): Promise<UserListResponse> {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.role) params.set('role', query.role);
  if (query.isActive !== undefined && query.isActive !== '') {
    params.set('isActive', String(query.isActive));
  }
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const qs = params.toString();
  const url = `/api/v1/users${qs ? `?${qs}` : ''}`;

  const res = await apiFetch(url);
  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch user accounts');
  }

  return (await res.json()) as UserListResponse;
}

/**
 * Fetches a single user account by ID.
 * GET /api/v1/users/:id
 */
export async function getUser(id: string): Promise<UserAccount> {
  const res = await apiFetch(`/api/v1/users/${encodeURIComponent(id)}`);
  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch user');
  }

  const json = (await res.json()) as { data: UserAccount };
  return json.data;
}

/**
 * Updates an account's complete role set. Admin only (D-21).
 * PUT /api/v1/users/:id/roles
 * Fails with 422 if attempting to remove the last active Admin.
 */
export async function updateUserRoles(id: string, roles: readonly Role[]): Promise<UserAccount> {
  const res = await apiFetch(`/api/v1/users/${encodeURIComponent(id)}/roles`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roles }),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to update user roles');
  }

  const json = (await res.json()) as { data: UserAccount };
  return json.data;
}

/**
 * Lists the four fixed roles with active account counts. Admin only.
 * GET /api/v1/roles
 */
export async function getRoles(): Promise<RoleSummary[]> {
  const res = await apiFetch('/api/v1/roles');
  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch roles');
  }

  const json = (await res.json()) as { data: RoleSummary[] };
  return json.data;
}

/**
 * Lists the complete permissions catalog with role grants. Admin only.
 * GET /api/v1/permissions
 */
export async function getPermissions(): Promise<PermissionSummary[]> {
  const res = await apiFetch('/api/v1/permissions');
  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch permissions');
  }

  const json = (await res.json()) as { data: PermissionSummary[] };
  return json.data;
}

