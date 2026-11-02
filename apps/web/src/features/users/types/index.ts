import type { PaginatedResponse, Role } from '@maxr/shared';

/** A user account with employee identity and role assignments. */
export interface UserAccount extends Record<string, unknown> {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: Role[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserFilters {
  search?: string;
  role?: Role | '';
  isActive?: boolean | '';
}

export type UserSortField = 'name' | 'email' | 'createdAt' | 'lastLoginAt';

export interface UserListQuery extends UserFilters {
  page: number;
  pageSize: number;
  sortBy?: UserSortField;
  sortOrder?: 'asc' | 'desc';
}

export type UserListResponse = PaginatedResponse<UserAccount>;

export interface RoleSummary {
  id: string;
  key: Role;
  name: string;
  description: string | null;
  activeUsers: number;
}

export interface PermissionSummary {
  key: string;
  module: string;
  action: string;
  description: string;
  grants: Record<string, string>;
}

export interface ReplaceRolesPayload {
  roles: Role[];
}

export interface RoleAssignmentResult {
  user: UserAccount;
  unchanged?: boolean;
}
