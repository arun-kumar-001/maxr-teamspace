import type { Role } from '@maxr/shared';

/** What authentication needs to know about an account. */
export interface AuthUser {
  id: string;
  employeeId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  /** The linked employee's status; only `active` employees can sign in (onboarding gate). */
  employeeStatus: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface FailureWindow {
  count: number;
  /** When the oldest counted failure happened; the lockout ends one window after it. */
  oldestAt: Date | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  /** Permission keys granted to the given role keys (`module.action`). */
  getPermissionKeys(roleKeys: string[]): Promise<string[]>;
  recordLoginAttempt(attempt: { identifier: string; ip: string; success: boolean }): Promise<void>;
  /** Failed attempts for an identifier since `since`, not counting any before its last success. */
  recentFailures(identifier: string, since: Date): Promise<FailureWindow>;
  touchLastLogin(userId: string, at: Date): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface Profile {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  roles: Role[];
  /** For showing or hiding UI only; the server checks permissions on every request (#8). */
  permissions: string[];
}

export interface RequestMeta {
  ip: string;
  requestId?: string;
}
