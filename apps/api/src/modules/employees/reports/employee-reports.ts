import type { Pool } from 'pg';
import { z } from 'zod';
import { validationError } from '../../../http/errors';
import { ReportDefinition, ReportRegistry } from '../../reports';
import { scopeToSql } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';

export interface EmployeeReportDeps {
  getPool: () => Pool;
  /** The company timezone decides which calendar day a leaver's deactivation falls on. */
  settings: CompanySettingsReader;
}

const MAX_RANGE_DAYS = 366;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Not a real calendar date');

const dayMs = 24 * 60 * 60 * 1000;

function assertRange(from: string, to: string): void {
  const days =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / dayMs;
  if (days < 0) {
    throw validationError([{ field: 'from', message: 'from must not be after to', rule: 'range' }]);
  }
  if (days >= MAX_RANGE_DAYS) {
    throw validationError([
      { field: 'to', message: `Use a range of at most ${MAX_RANGE_DAYS} days`, rule: 'range' },
    ]);
  }
}

/** Every report here reads the employee directory, so it needs, and is scoped by, `employees.list`. */
const DATA_PERMISSIONS = ['employees.list'] as ReportDefinition['dataPermissions'];

const count = (row: { total?: number } | undefined): number => row?.total ?? 0;

export function headcountReport(deps: EmployeeReportDeps) {
  const filters = z
    .object({
      groupBy: z.enum(['department', 'designation']).default('department'),
      departmentId: z.string().uuid().optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'employee-headcount',
    title: 'Headcount',
    description:
      'Employees per department or designation, split into active, pending and deactivated',
    module: 'employees',
    dataPermissions: DATA_PERMISSIONS,
    filters,
    columns: [
      { key: 'group', label: 'Group' },
      { key: 'active', label: 'Active' },
      { key: 'pending', label: 'Pending' },
      { key: 'deactivated', label: 'Deactivated' },
      { key: 'total', label: 'Total' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      const values: unknown[] = [];
      const scoped = scopeToSql(scope, 'e.id', 1);
      values.push(...scoped.values);
      const conditions = [scoped.clause];
      if (f.departmentId) {
        values.push(f.departmentId);
        conditions.push(`e.department_id = $${values.length}`);
      }
      const byDesignation = f.groupBy === 'designation';
      const from = byDesignation
        ? `employees e JOIN designations g ON g.id = e.designation_id
           JOIN departments d ON d.id = g.department_id`
        : `employees e JOIN departments d ON d.id = e.department_id`;
      const key = byDesignation ? 'g.id' : 'd.id';
      const label = byDesignation ? `g.title || ' (' || d.name || ')'` : 'd.name';
      const where = conditions.join(' AND ');

      const total = await deps
        .getPool()
        .query<{ total: number }>(
          `SELECT COUNT(DISTINCT ${key})::int AS total FROM ${from} WHERE ${where}`,
          values,
        );
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT ${label} AS "group",
                COUNT(*) FILTER (WHERE e.status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE e.status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE e.status = 'deactivated')::int AS deactivated,
                COUNT(*)::int AS total
           FROM ${from}
          WHERE ${where}
          GROUP BY ${key}, ${label}
          ORDER BY ${label}, ${key}
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: count(total.rows[0]) };
    },
  };
  return definition;
}

export function joinersLeaversReport(deps: EmployeeReportDeps) {
  const filters = z
    .object({
      from: isoDate,
      to: isoDate,
      event: z.enum(['all', 'joined', 'left']).default('all'),
      departmentId: z.string().uuid().optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'joiners-leavers',
    title: 'Joiners and leavers',
    description:
      'Employees who joined or were deactivated between two dates, in the company timezone',
    module: 'employees',
    dataPermissions: DATA_PERMISSIONS,
    // Plain object on purpose: the framework reuses its `shape`, which would drop any refinement.
    // The range rules are checked at the start of `run`.
    filters,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'event', label: 'Event' },
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      assertRange(f.from, f.to);
      const { timezone } = await deps.settings.getBasic();
      const values: unknown[] = [];
      const scoped = scopeToSql(scope, 'e.id', 1);
      values.push(...scoped.values);
      const base = [scoped.clause];
      if (f.departmentId) {
        values.push(f.departmentId);
        base.push(`e.department_id = $${values.length}`);
      }
      values.push(f.from);
      const from = `$${values.length}::date`;
      values.push(f.to);
      const to = `$${values.length}::date`;
      // Only the "left" half reads the timezone; PostgreSQL rejects a parameter nothing refers to.
      let zone = '';
      if (f.event !== 'joined') {
        values.push(timezone);
        zone = `$${values.length}::text`;
      }

      const parts: string[] = [];
      if (f.event !== 'left') {
        parts.push(
          `SELECT e.joining_date AS date, 'joined' AS event, e.id, e.employee_code, e.first_name,
                  e.last_name, e.department_id, e.designation_id
             FROM employees e
            WHERE ${base.join(' AND ')} AND e.joining_date BETWEEN ${from} AND ${to}`,
        );
      }
      if (f.event !== 'joined') {
        parts.push(
          `SELECT (e.deactivated_at AT TIME ZONE ${zone})::date AS date, 'left' AS event, e.id,
                  e.employee_code, e.first_name, e.last_name, e.department_id, e.designation_id
             FROM employees e
            WHERE ${base.join(' AND ')} AND e.status = 'deactivated'
              AND (e.deactivated_at AT TIME ZONE ${zone})::date BETWEEN ${from} AND ${to}`,
        );
      }
      const events = parts.join(' UNION ALL ');
      const total = await deps
        .getPool()
        .query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM (${events}) ev`, values);
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT to_char(ev.date, 'YYYY-MM-DD') AS date, ev.event, ev.employee_code AS "employeeCode",
                TRIM(CONCAT(ev.first_name, ' ', ev.last_name)) AS "employeeName",
                d.name AS department, g.title AS designation
           FROM (${events}) ev
           JOIN departments d ON d.id = ev.department_id
           JOIN designations g ON g.id = ev.designation_id
          ORDER BY ev.date, ev.event, ev.employee_code, ev.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: count(total.rows[0]) };
    },
  };
  return definition;
}

export function directoryReport(deps: EmployeeReportDeps) {
  const filters = z
    .object({
      departmentId: z.string().uuid().optional(),
      designationId: z.string().uuid().optional(),
      managerId: z.string().uuid().optional(),
      status: z.enum(['active', 'pending', 'deactivated']).optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'employee-directory',
    title: 'Employee directory',
    description: 'The employee directory as a list, for export',
    module: 'employees',
    dataPermissions: DATA_PERMISSIONS,
    filters,
    // Contact details the directory already shows; no ID documents, bank or compensation data.
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'manager', label: 'Manager' },
      { key: 'status', label: 'Status' },
      { key: 'joiningDate', label: 'Joining date' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      const values: unknown[] = [];
      const scoped = scopeToSql(scope, 'e.id', 1);
      values.push(...scoped.values);
      const conditions = [scoped.clause];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        conditions.push(sql.replace('?', `$${values.length}`));
      };
      if (f.departmentId) add('e.department_id = ?', f.departmentId);
      if (f.designationId) add('e.designation_id = ?', f.designationId);
      if (f.managerId) add('e.manager_id = ?', f.managerId);
      if (f.status) add('e.status = ?', f.status);
      const where = conditions.join(' AND ');

      const total = await deps
        .getPool()
        .query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM employees e WHERE ${where}`,
          values,
        );
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT e.employee_code AS "employeeCode",
                TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "employeeName",
                e.email, e.phone, d.name AS department, g.title AS designation,
                NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') AS manager,
                e.status, to_char(e.joining_date, 'YYYY-MM-DD') AS "joiningDate"
           FROM employees e
           JOIN departments d ON d.id = e.department_id
           JOIN designations g ON g.id = e.designation_id
           LEFT JOIN employees m ON m.id = e.manager_id
          WHERE ${where}
          ORDER BY e.last_name, e.first_name, e.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: count(total.rows[0]) };
    },
  };
  return definition;
}

export function registerEmployeeReports(registry: ReportRegistry, deps: EmployeeReportDeps): void {
  registry.register(headcountReport(deps));
  registry.register(joinersLeaversReport(deps));
  registry.register(directoryReport(deps));
}
