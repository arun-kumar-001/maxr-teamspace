import type { Role } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import {
  CreateEmployeeDto,
  CreatedEmployee,
  CreationTx,
  ExistingIdentity,
  ReferenceRows,
} from './creation.types';

export interface IEmployeeCreationRepository {
  transaction<T>(work: (tx: CreationTx) => Promise<T>): Promise<T>;
  lockReferences(
    tx: CreationTx,
    ids: { departmentId: string; designationId: string; managerId?: string },
  ): Promise<ReferenceRows>;
  findExisting(tx: CreationTx, code: string, email: string): Promise<ExistingIdentity>;
  /** Inserts the employee (status `pending`), its inactive user account and the role. */
  insertAccount(
    tx: CreationTx,
    dto: CreateEmployeeDto,
    passwordHash: string,
  ): Promise<CreatedEmployee>;
}

interface InsertedRow {
  id: string;
  created_at: Date | string;
  joining_date: Date | string;
}

const toDateOnly = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

export class PgEmployeeCreationRepository implements IEmployeeCreationRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: CreationTx) => Promise<T>): Promise<T> {
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

  async lockReferences(
    tx: CreationTx,
    ids: { departmentId: string; designationId: string; managerId?: string },
  ): Promise<ReferenceRows> {
    const department = await tx.query<{ is_active: boolean }>(
      `SELECT is_active FROM departments WHERE id = $1 FOR SHARE`,
      [ids.departmentId],
    );
    const designation = await tx.query<{ is_active: boolean; department_id: string }>(
      `SELECT is_active, department_id FROM designations WHERE id = $1 FOR SHARE`,
      [ids.designationId],
    );
    const manager = ids.managerId
      ? await tx.query<{ status: string }>(`SELECT status FROM employees WHERE id = $1 FOR SHARE`, [
          ids.managerId,
        ])
      : null;
    const d = department.rows[0];
    const g = designation.rows[0];
    const m = manager?.rows[0];
    return {
      department: d ? { isActive: d.is_active } : null,
      designation: g ? { isActive: g.is_active, departmentId: g.department_id } : null,
      manager: m ? { status: m.status } : null,
    };
  }

  async findExisting(tx: CreationTx, code: string, email: string): Promise<ExistingIdentity> {
    const res = await tx.query<{ code_taken: boolean; email_taken: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM employees WHERE LOWER(employee_code) = LOWER($1)) AS code_taken,
              (EXISTS (SELECT 1 FROM employees WHERE LOWER(email) = LOWER($2))
               OR EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER($2))) AS email_taken`,
      [code, email],
    );
    return {
      employeeCode: res.rows[0]?.code_taken ?? false,
      email: res.rows[0]?.email_taken ?? false,
    };
  }

  async insertAccount(
    tx: CreationTx,
    dto: CreateEmployeeDto,
    passwordHash: string,
  ): Promise<CreatedEmployee> {
    const employee = await tx.query<InsertedRow>(
      `INSERT INTO employees
         (employee_code, first_name, last_name, email, phone, department_id, designation_id,
          manager_id, status, joining_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       RETURNING id, created_at, joining_date`,
      [
        dto.employeeCode,
        dto.firstName,
        dto.lastName,
        dto.email,
        dto.phone ?? null,
        dto.departmentId,
        dto.designationId,
        dto.managerId ?? null,
        dto.joiningDate,
      ],
    );
    const row = employee.rows[0] as InsertedRow;
    // Inactive until onboarding activates the account (D-20); the hash can never match a password.
    const user = await tx.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash, is_active)
       VALUES ($1, $2, $3, false) RETURNING id`,
      [row.id, dto.email, passwordHash],
    );
    const userId = (user.rows[0] as { id: string }).id;
    const role = await tx.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
      [userId, dto.role],
    );
    if (role.rowCount !== 1) {
      throw new Error(`Role '${dto.role}' does not exist in the roles table`);
    }
    return {
      id: row.id,
      userId,
      employeeCode: dto.employeeCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone ?? null,
      departmentId: dto.departmentId,
      designationId: dto.designationId,
      managerId: dto.managerId ?? null,
      status: 'pending',
      role: dto.role as Role,
      joiningDate: toDateOnly(row.joining_date),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
