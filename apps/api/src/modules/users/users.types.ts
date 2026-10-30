import type { Role } from '@maxr/shared';

/** A sign-in account with its employee identity. Never carries the password hash. */
export interface UserAccount {
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
  /** Matches name, email or employee code. */
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export type UserSortField = 'name' | 'email' | 'createdAt' | 'lastLoginAt';

export interface UserFindManyParams extends UserFilters {
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
  offset: number;
  limit: number;
}

export interface RoleSummary {
  id: string;
  key: Role;
  name: string;
  description: string | null;
  /** Active accounts that hold the role. */
  activeUsers: number;
}

export type ReplaceRolesResult =
  | { status: 'not_found' }
  | { status: 'last_admin' }
  | { status: 'unchanged'; user: UserAccount }
  | { status: 'changed'; user: UserAccount; before: Role[] };
