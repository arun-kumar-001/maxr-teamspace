import type { Role } from '@maxr/shared';
import type { PoolClient } from 'pg';

/** The open transaction employee creation runs in. */
export type CreationTx = Pick<PoolClient, 'query'>;

export interface CreateEmployeeDto {
  employeeCode: string;
  firstName: string;
  lastName: string;
  /** Stored lower case: it is also the sign-in name. */
  email: string;
  phone?: string;
  departmentId: string;
  designationId: string;
  managerId?: string;
  /** `YYYY-MM-DD`. */
  joiningDate: string;
  role: Role;
}

/** What the new employee looks like in the response. No credentials, ever. */
export interface CreatedEmployee {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string;
  designationId: string;
  managerId: string | null;
  /** `pending`: the account cannot sign in until onboarding activates it (D-20). */
  status: 'pending';
  role: Role;
  joiningDate: string;
  createdAt: string;
}

export type { ReferenceRows } from '../references';

export interface ExistingIdentity {
  employeeCode: boolean;
  email: boolean;
}
