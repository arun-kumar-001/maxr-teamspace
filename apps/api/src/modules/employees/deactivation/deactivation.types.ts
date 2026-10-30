import type { PoolClient } from 'pg';

export type DeactivationTx = Pick<PoolClient, 'query'>;

export type EmployeeStatus = 'active' | 'pending' | 'deactivated';

/** The employee and the sign-in account behind them, read under a lock. */
export interface DeactivationTarget {
  employeeId: string;
  status: EmployeeStatus;
  /** Null for an employee who never got an account. */
  userId: string | null;
  userActive: boolean;
  holdsAdminRole: boolean;
}

/** A person who still reports to the employee being deactivated and now needs a new manager (#23). */
export interface DirectReport {
  id: string;
  employeeCode: string;
  name: string;
}

export interface DeactivationRecord {
  deactivatedAt: string;
  version: number;
}

export interface DeactivationResult {
  id: string;
  status: 'deactivated';
  deactivatedAt: string;
  version: number;
  /** True when the employee was already deactivated: nothing was changed or audited. */
  alreadyDeactivated: boolean;
  /** Sessions ended by this call. */
  sessionsRevoked: number;
  /** Their direct reports, who now have a deactivated manager. */
  directReports: DirectReport[];
}

/** What deactivation needs from the auth module: end every session of an account. */
export interface SessionRevoker {
  revokeAllForUser(userId: string): Promise<number>;
}
