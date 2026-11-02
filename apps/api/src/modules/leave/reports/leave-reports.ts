import type { Pool } from 'pg';
import { z } from 'zod';
import { ReportDefinition, ReportRegistry } from '../../reports';
import { companyDate } from '../../reports/report-filters';
import { scopeToSql } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';

export interface LeaveReportDeps {
  getPool: () => Pool;
  settings: CompanySettingsReader;
  clock?: () => Date;
}

/**
 * Leave balance and usage per employee and leave type for a year (D-12): what was allotted,
 * carried forward, used (approved leave already deducted), still pending approval, and what is
 * left. Scope is applied in the query: a Team Lead sees direct reports, HR and Admin everyone.
 */
export function leaveUsageReport(deps: LeaveReportDeps) {
  const filters = z
    .object({
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      leaveTypeId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'leave-usage',
    title: 'Leave balance and usage',
    description:
      'Days allotted, carried forward, used, pending approval and remaining per employee and leave type for a year',
    module: 'leave',
    dataPermissions: ['leave_balances.list'],
    filters,
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'leaveType', label: 'Leave type' },
      { key: 'year', label: 'Year' },
      { key: 'allotted', label: 'Allotted' },
      { key: 'carriedForward', label: 'Carried forward' },
      { key: 'used', label: 'Used' },
      { key: 'pending', label: 'Pending' },
      { key: 'remaining', label: 'Remaining' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      const { timezone } = await deps.settings.getBasic();
      const year =
        f.year ?? Number(companyDate((deps.clock ?? (() => new Date()))(), timezone).slice(0, 4));
      const values: unknown[] = [];
      const add = (value: unknown) => {
        values.push(value);
        return `$${values.length}`;
      };
      const scoped = scopeToSql(scope, 'b.employee_id', 1);
      values.push(...scoped.values);
      let where = `${scoped.clause} AND b.year = ${add(year)}`;
      if (f.leaveTypeId) where += ` AND b.leave_type_id = ${add(f.leaveTypeId)}`;
      if (f.departmentId) where += ` AND e.department_id = ${add(f.departmentId)}`;
      const from = `leave_balances b
          JOIN employees e ON e.id = b.employee_id
          JOIN departments d ON d.id = e.department_id
          JOIN leave_types t ON t.id = b.leave_type_id`;
      const total = await deps
        .getPool()
        .query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM ${from} WHERE ${where}`,
          values,
        );
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT e.employee_code AS "employeeCode",
                TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "employeeName",
                d.name AS department, t.name AS "leaveType", b.year,
                b.allotted::float AS allotted, b.carried_forward::float AS "carriedForward",
                b.used::float AS used,
                COALESCE((SELECT SUM(r.days) FROM leave_requests r
                           WHERE r.employee_id = b.employee_id AND r.leave_type_id = b.leave_type_id
                             AND EXTRACT(YEAR FROM r.start_date) = b.year
                             AND r.status IN ('applied', 'pending')), 0)::float AS pending,
                (b.allotted + b.carried_forward - b.used)::float AS remaining
           FROM ${from}
          WHERE ${where}
          ORDER BY e.employee_code, t.name, b.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: total.rows[0]?.total ?? 0 };
    },
  };
  return definition;
}

export function registerLeaveReports(registry: ReportRegistry, deps: LeaveReportDeps): void {
  registry.register(leaveUsageReport(deps));
}
