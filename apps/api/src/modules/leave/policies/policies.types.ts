import type { Pool, PoolClient } from 'pg';

export type LeaveTx = Pick<PoolClient, 'query'>;

/** A leave type with its policy. `id` is the leave type id; that is what the routes address. */
export interface LeavePolicy {
  id: string;
  code: string;
  name: string;
  hasBalance: boolean;
  isActive: boolean;
  annualDays: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  maxBackdateDays: number;
  /** Compare-and-set token: an update must send the version it read. */
  version: number;
  updatedAt: string;
}

export interface NewLeavePolicy {
  code: string;
  name: string;
  hasBalance: boolean;
  annualDays: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  maxBackdateDays: number;
}

export type LeavePolicyValues = Omit<
  LeavePolicy,
  'id' | 'code' | 'hasBalance' | 'version' | 'updatedAt'
>;

export type PoolGetter = () => Pool;
