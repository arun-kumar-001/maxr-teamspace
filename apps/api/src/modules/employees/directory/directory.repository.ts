import type { Pool } from 'pg';
import { scopeAllows, scopeToSql } from '../../rbac/scope';
import {
  EmployeeDirectoryFindManyParams,
  EmployeeDirectoryItem,
  EmployeeStatus,
} from './directory.types';

export interface IEmployeeDirectoryRepository {
  findMany(
    params: EmployeeDirectoryFindManyParams,
  ): Promise<{ items: EmployeeDirectoryItem[]; total: number }>;
  findById(id: string): Promise<EmployeeDirectoryItem | null>;
}

interface EmployeeDirectoryRow {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  joining_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  dept_id: string;
  dept_name: string;
  dept_code: string;
  desig_id: string;
  desig_title: string;
  desig_code: string;
  desig_level: number;
  manager_id: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_employee_code: string | null;
}

const toEntity = (row: EmployeeDirectoryRow): EmployeeDirectoryItem => ({
  id: row.id,
  employeeCode: row.employee_code,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  department: {
    id: row.dept_id,
    name: row.dept_name,
    code: row.dept_code,
  },
  designation: {
    id: row.desig_id,
    title: row.desig_title,
    code: row.desig_code,
    level: row.desig_level,
  },
  manager: row.manager_id
    ? {
        id: row.manager_id,
        firstName: row.manager_first_name ?? '',
        lastName: row.manager_last_name ?? '',
        employeeCode: row.manager_employee_code ?? '',
      }
    : null,
  status: row.status as EmployeeStatus,
  joiningDate:
    row.joining_date instanceof Date
      ? row.joining_date.toISOString().slice(0, 10)
      : String(row.joining_date).slice(0, 10),
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date(row.updated_at).toISOString(),
});

const escapeLikePattern = (input: string): string => input.replace(/([\\%_])/g, '\\$1');

export class PgEmployeeDirectoryRepository implements IEmployeeDirectoryRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findMany(
    params: EmployeeDirectoryFindManyParams,
  ): Promise<{ items: EmployeeDirectoryItem[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    // 1. Authoritative record scope from RBAC
    const { clause: scopeClause, values: scopeValues } = scopeToSql(
      params.filter,
      'e.id',
      values.length + 1,
    );
    conditions.push(scopeClause);
    values.push(...scopeValues);

    // 2. Query filters
    if (params.departmentId) {
      values.push(params.departmentId);
      conditions.push(`e.department_id = $${values.length}`);
    }

    if (params.designationId) {
      values.push(params.designationId);
      conditions.push(`e.designation_id = $${values.length}`);
    }

    if (params.status) {
      values.push(params.status);
      conditions.push(`e.status = $${values.length}`);
    }

    if (params.managerId) {
      values.push(params.managerId);
      conditions.push(`e.manager_id = $${values.length}`);
    }

    if (params.search) {
      const escaped = escapeLikePattern(params.search);
      values.push(`%${escaped}%`);
      const searchPlaceholder = `$${values.length}`;
      conditions.push(`(
        e.employee_code ILIKE ${searchPlaceholder} ESCAPE '\\' OR
        e.first_name ILIKE ${searchPlaceholder} ESCAPE '\\' OR
        e.last_name ILIKE ${searchPlaceholder} ESCAPE '\\' OR
        e.email ILIKE ${searchPlaceholder} ESCAPE '\\'
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumnMap: Record<string, string> = {
      name: 'e.last_name, e.first_name',
      employeeCode: 'e.employee_code',
      joiningDate: 'e.joining_date',
      createdAt: 'e.created_at',
    };
    const sortCol = sortColumnMap[params.sort.column] ?? 'e.last_name, e.first_name';
    const sortDir = params.sort.order === 'asc' ? 'ASC' : 'DESC';

    const orderClause =
      sortCol === 'e.last_name, e.first_name'
        ? `e.last_name ${sortDir}, e.first_name ${sortDir}, e.id ASC`
        : `${sortCol} ${sortDir}, e.id ASC`;

    // 3. Count query
    const countRes = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM employees e
         JOIN departments d ON e.department_id = d.id
         JOIN designations des ON e.designation_id = des.id
         LEFT JOIN employees m ON e.manager_id = m.id
        ${whereClause}`,
      values,
    );
    const total = countRes.rows[0]?.count ?? 0;

    // 4. Data query with LIMIT and OFFSET
    const dataValues = [...values, params.limit, params.offset];
    const limitPlaceholder = `$${dataValues.length - 1}`;
    const offsetPlaceholder = `$${dataValues.length}`;

    const res = await this.getPool().query<EmployeeDirectoryRow>(
      `SELECT
         e.id,
         e.employee_code,
         e.first_name,
         e.last_name,
         e.email,
         e.phone,
         e.status,
         e.joining_date,
         e.created_at,
         e.updated_at,
         d.id AS dept_id,
         d.name AS dept_name,
         d.code AS dept_code,
         des.id AS desig_id,
         des.title AS desig_title,
         des.code AS desig_code,
         des.level AS desig_level,
         m.id AS manager_id,
         m.first_name AS manager_first_name,
         m.last_name AS manager_last_name,
         m.employee_code AS manager_employee_code
        FROM employees e
        JOIN departments d ON e.department_id = d.id
        JOIN designations des ON e.designation_id = des.id
        LEFT JOIN employees m ON e.manager_id = m.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      dataValues,
    );

    return {
      items: res.rows.map(toEntity),
      total,
    };
  }

  async findById(id: string): Promise<EmployeeDirectoryItem | null> {
    const res = await this.getPool().query<EmployeeDirectoryRow>(
      `SELECT
         e.id,
         e.employee_code,
         e.first_name,
         e.last_name,
         e.email,
         e.phone,
         e.status,
         e.joining_date,
         e.created_at,
         e.updated_at,
         d.id AS dept_id,
         d.name AS dept_name,
         d.code AS dept_code,
         des.id AS desig_id,
         des.title AS desig_title,
         des.code AS desig_code,
         des.level AS desig_level,
         m.id AS manager_id,
         m.first_name AS manager_first_name,
         m.last_name AS manager_last_name,
         m.employee_code AS manager_employee_code
        FROM employees e
        JOIN departments d ON e.department_id = d.id
        JOIN designations des ON e.designation_id = des.id
        LEFT JOIN employees m ON e.manager_id = m.id
       WHERE e.id = $1`,
      [id],
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }
}

export class MemoryEmployeeDirectoryRepository implements IEmployeeDirectoryRepository {
  private readonly items = new Map<string, EmployeeDirectoryItem>();

  add(item: EmployeeDirectoryItem): void {
    this.items.set(item.id, item);
  }

  async findById(id: string): Promise<EmployeeDirectoryItem | null> {
    return this.items.get(id) ?? null;
  }

  async findMany(
    params: EmployeeDirectoryFindManyParams,
  ): Promise<{ items: EmployeeDirectoryItem[]; total: number }> {
    let rows = [...this.items.values()];

    // 1. Authoritative record scope
    rows = rows.filter((item) => scopeAllows(params.filter, item.id, item.manager?.id));

    // 2. Query filters
    if (params.departmentId) {
      rows = rows.filter((r) => r.department.id === params.departmentId);
    }
    if (params.designationId) {
      rows = rows.filter((r) => r.designation.id === params.designationId);
    }
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }
    if (params.managerId) {
      rows = rows.filter((r) => r.manager?.id === params.managerId);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.employeeCode.toLowerCase().includes(q) ||
          r.firstName.toLowerCase().includes(q) ||
          r.lastName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q),
      );
    }

    // 3. Sorting with deterministic tie-breaker
    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (params.sort.column) {
        case 'employeeCode':
          cmp = a.employeeCode.localeCompare(b.employeeCode);
          break;
        case 'joiningDate':
          cmp = a.joiningDate.localeCompare(b.joiningDate);
          break;
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'name':
        default: {
          const nameA = `${a.lastName} ${a.firstName}`;
          const nameB = `${b.lastName} ${b.firstName}`;
          cmp = nameA.localeCompare(nameB);
          break;
        }
      }
      if (cmp !== 0) {
        return cmp * direction;
      }
      return a.id.localeCompare(b.id);
    });

    return {
      items: rows.slice(params.offset, params.offset + params.limit),
      total: rows.length,
    };
  }
}
