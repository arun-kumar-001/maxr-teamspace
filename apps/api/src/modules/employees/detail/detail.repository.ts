import type { Role } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { ScopeFilter, scopeToSql } from '../../rbac';
import { ReferenceIds, ReferenceRows, lockReferenceRows } from '../references';
import {
  DetailTx,
  EditableEmployee,
  EmployeeDetail,
  EmployeePatch,
  EmployeeStatus,
  PatchField,
} from './detail.types';

export interface IEmployeeDetailRepository {
  transaction<T>(work: (tx: DetailTx) => Promise<T>): Promise<T>;
  /** One employee inside the caller's scope; null when missing or out of scope. */
  findById(id: string, filter: ScopeFilter, withAccount: boolean): Promise<EmployeeDetail | null>;
  load(tx: DetailTx, id: string, withAccount: boolean): Promise<EmployeeDetail>;
  /** Locks the row until the transaction ends, so concurrent edits run one at a time. */
  lockEditable(tx: DetailTx, id: string): Promise<EditableEmployee | null>;
  lockReferences(tx: DetailTx, ids: ReferenceIds): Promise<ReferenceRows>;
  isTaken(
    tx: DetailTx,
    taken: { employeeCode?: string; email?: string },
    excludeId: string,
  ): Promise<{ employeeCode: boolean; email: boolean }>;
  /** Writes the changed fields; an email change is written to the sign-in account as well. */
  applyPatch(tx: DetailTx, id: string, patch: EmployeePatch): Promise<void>;
}

interface Row {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: EmployeeStatus;
  joining_date: string;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
  dept_id: string;
  dept_name: string;
  dept_code: string;
  desig_id: string;
  desig_title: string;
  desig_code: string;
  manager_id: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_code: string | null;
  user_id: string | null;
  user_active: boolean | null;
  last_login_at: Date | string | null;
  roles: string[];
}

const iso = (value: Date | string): string => new Date(value).toISOString();

const toDetail = (row: Row, withAccount: boolean): EmployeeDetail => ({
  id: row.id,
  employeeCode: row.employee_code,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  department: { id: row.dept_id, name: row.dept_name, code: row.dept_code },
  designation: { id: row.desig_id, title: row.desig_title, code: row.desig_code },
  manager: row.manager_id
    ? {
        id: row.manager_id,
        firstName: row.manager_first_name ?? '',
        lastName: row.manager_last_name ?? '',
        employeeCode: row.manager_code ?? '',
      }
    : null,
  status: row.status,
  joiningDate: row.joining_date,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  version: row.version,
  ...(withAccount
    ? {
        account: {
          userId: row.user_id,
          isActive: row.user_active ?? false,
          lastLoginAt: row.last_login_at ? iso(row.last_login_at) : null,
          roles: row.roles as Role[],
        },
      }
    : {}),
});

const SELECT = `
  SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.status,
         to_char(e.joining_date, 'YYYY-MM-DD') AS joining_date,
         e.created_at, e.updated_at, e.version,
         d.id AS dept_id, d.name AS dept_name, d.code AS dept_code,
         g.id AS desig_id, g.title AS desig_title, g.code AS desig_code,
         m.id AS manager_id, m.first_name AS manager_first_name,
         m.last_name AS manager_last_name, m.employee_code AS manager_code,
         u.id AS user_id, u.is_active AS user_active, u.last_login_at,
         COALESCE(array_agg(r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    JOIN designations g ON g.id = e.designation_id
    LEFT JOIN employees m ON m.id = e.manager_id
    LEFT JOIN users u ON u.employee_id = e.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id`;

const GROUP = 'GROUP BY e.id, d.id, g.id, m.id, u.id';

/** API field -> column. A fixed list, so a request never chooses a column name. */
const COLUMNS: Record<PatchField, string> = {
  employeeCode: 'employee_code',
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  departmentId: 'department_id',
  designationId: 'designation_id',
  joiningDate: 'joining_date',
};

export class PgEmployeeDetailRepository implements IEmployeeDetailRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: DetailTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(
    id: string,
    filter: ScopeFilter,
    withAccount: boolean,
  ): Promise<EmployeeDetail | null> {
    const scope = scopeToSql(filter, 'e.id', 2);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE e.id = $1 AND ${scope.clause} ${GROUP}`,
      [id, ...scope.values],
    );
    return res.rows[0] ? toDetail(res.rows[0], withAccount) : null;
  }

  async load(tx: DetailTx, id: string, withAccount: boolean): Promise<EmployeeDetail> {
    const res = await tx.query<Row>(`${SELECT} WHERE e.id = $1 ${GROUP}`, [id]);
    if (!res.rows[0]) throw new Error(`Employee ${id} vanished inside its transaction`);
    return toDetail(res.rows[0], withAccount);
  }

  async lockEditable(tx: DetailTx, id: string): Promise<EditableEmployee | null> {
    const res = await tx.query<{
      id: string;
      status: EmployeeStatus;
      version: number;
      manager_id: string | null;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      department_id: string;
      designation_id: string;
      joining_date: string;
    }>(
      `SELECT id, status, version, manager_id, employee_code, first_name, last_name, email, phone,
              department_id, designation_id, to_char(joining_date, 'YYYY-MM-DD') AS joining_date
         FROM employees WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const r = res.rows[0];
    return r
      ? {
          id: r.id,
          status: r.status,
          version: r.version,
          managerId: r.manager_id,
          employeeCode: r.employee_code,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          departmentId: r.department_id,
          designationId: r.designation_id,
          joiningDate: r.joining_date,
        }
      : null;
  }

  lockReferences(tx: DetailTx, ids: ReferenceIds): Promise<ReferenceRows> {
    return lockReferenceRows(tx, ids);
  }

  async isTaken(
    tx: DetailTx,
    taken: { employeeCode?: string; email?: string },
    excludeId: string,
  ): Promise<{ employeeCode: boolean; email: boolean }> {
    const res = await tx.query<{ code_taken: boolean; email_taken: boolean }>(
      `SELECT ($2::text IS NOT NULL AND EXISTS (
                SELECT 1 FROM employees WHERE LOWER(employee_code) = LOWER($2) AND id <> $1)) AS code_taken,
              ($3::text IS NOT NULL AND (
                EXISTS (SELECT 1 FROM employees WHERE LOWER(email) = LOWER($3) AND id <> $1)
                OR EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER($3) AND employee_id <> $1)
              )) AS email_taken`,
      [excludeId, taken.employeeCode ?? null, taken.email ?? null],
    );
    return {
      employeeCode: res.rows[0]?.code_taken ?? false,
      email: res.rows[0]?.email_taken ?? false,
    };
  }

  async applyPatch(tx: DetailTx, id: string, patch: EmployeePatch): Promise<void> {
    const fields = (Object.keys(patch) as PatchField[]).filter((f) => f in COLUMNS);
    if (fields.length === 0) return;
    const values: unknown[] = [id];
    const sets = fields.map((field) => {
      values.push(patch[field] ?? null);
      return `${COLUMNS[field]} = $${values.length}`;
    });
    await tx.query(`UPDATE employees SET ${sets.join(', ')} WHERE id = $1`, values);
    if (patch.email !== undefined) {
      await tx.query(`UPDATE users SET email = $2, updated_at = NOW() WHERE employee_id = $1`, [
        id,
        patch.email,
      ]);
    }
  }
}
