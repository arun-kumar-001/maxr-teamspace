import type { Pool } from 'pg';
import { z } from 'zod';
import { ReportDefinition, ReportRegistry } from '../../reports';
import { assertRange, companyDate, isoDate, workDayNumbers } from '../../reports/report-filters';
import { scopeToSql } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';

export interface AttendanceReportDeps {
  getPool: () => Pool;
  settings: CompanySettingsReader;
  clock?: () => Date;
}

/** A summary spans at most this many days: it builds a calendar day by employee. */
export const MAX_ATTENDANCE_RANGE_DAYS = 92;

/**
 * Attendance per employee between two dates (D-13).
 *
 * - **Working days** are the company's working days (settings) that are not holidays, from the
 *   day the employee joined until the day they were deactivated, and not after today.
 * - **Present** is a day with at least one session; **late** a day whose first session was late.
 * - **Half days** are present days whose worked time reached the policy's half day but not its full day.
 * - **On leave** is a working day covered by approved leave; **absent** a working day with no
 *   session and no approved leave.
 *
 * Scope is applied in the query, so a Team Lead's summary holds their direct reports only.
 */
export function attendanceSummaryReport(deps: AttendanceReportDeps) {
  const filters = z
    .object({
      from: isoDate,
      to: isoDate,
      departmentId: z.string().uuid().optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'attendance-summary',
    title: 'Attendance summary',
    description:
      'Days worked, late, half days, on leave and absent per employee between two dates, with hours worked',
    module: 'attendance',
    dataPermissions: ['attendance.list'],
    filters,
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'workingDays', label: 'Working days' },
      { key: 'daysPresent', label: 'Days present' },
      { key: 'lateDays', label: 'Late days' },
      { key: 'halfDays', label: 'Half days' },
      { key: 'onLeaveDays', label: 'On leave' },
      { key: 'absentDays', label: 'Absent' },
      { key: 'totalHours', label: 'Hours worked' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      assertRange(f.from, f.to, MAX_ATTENDANCE_RANGE_DAYS);
      const { timezone, workWeek } = await deps.settings.getBasic();
      const today = companyDate((deps.clock ?? (() => new Date()))(), timezone);

      const values: unknown[] = [];
      const add = (value: unknown) => {
        values.push(value);
        return `$${values.length}`;
      };
      const scoped = scopeToSql(scope, 'e.id', 1);
      values.push(...scoped.values);
      let employeeWhere = scoped.clause;
      if (f.departmentId) employeeWhere += ` AND e.department_id = ${add(f.departmentId)}`;
      const from = `${add(f.from)}::date`;
      const to = `${add(f.to)}::date`;
      const upTo = `LEAST(${to}, ${add(today)}::date)`;
      const zone = `${add(timezone)}::text`;
      const dows = `${add(workDayNumbers(workWeek.days))}::int[]`;

      const cte = `
        WITH emp AS (
          SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department_id, e.joining_date,
                 (e.deactivated_at AT TIME ZONE ${zone})::date AS left_on
            FROM employees e WHERE ${employeeWhere}
        ),
        cal AS (
          SELECT g::date AS d FROM generate_series(${from}, ${upTo}, INTERVAL '1 day') g
           WHERE EXTRACT(DOW FROM g)::int = ANY(${dows})
             AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = g::date)
        ),
        edays AS (
          SELECT emp.id AS employee_id, cal.d FROM emp
            JOIN cal ON cal.d >= emp.joining_date AND (emp.left_on IS NULL OR cal.d <= emp.left_on)
        ),
        policy AS (SELECT full_day_minutes, half_day_minutes FROM attendance_policies LIMIT 1),
        day_att AS (
          SELECT a.employee_id, a.work_date AS d,
                 SUM(COALESCE(a.duration_minutes, 0))::int AS minutes,
                 (ARRAY_AGG(a.status ORDER BY a.check_in_time))[1] AS first_status
            FROM attendance_records a
           WHERE a.work_date BETWEEN ${from} AND ${to} AND a.employee_id IN (SELECT id FROM emp)
           GROUP BY a.employee_id, a.work_date
        ),
        leave_days AS (
          SELECT DISTINCT ed.employee_id, ed.d FROM edays ed
            JOIN leave_requests r ON r.employee_id = ed.employee_id AND r.status = 'approved'
             AND ed.d BETWEEN r.start_date AND r.end_date
        )`;
      const total = await deps
        .getPool()
        .query<{ total: number }>(`${cte} SELECT COUNT(*)::int AS total FROM emp`, values);
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `${cte}
         SELECT emp.employee_code AS "employeeCode",
                TRIM(CONCAT(emp.first_name, ' ', emp.last_name)) AS "employeeName",
                dept.name AS department,
                (SELECT COUNT(*)::int FROM edays x WHERE x.employee_id = emp.id) AS "workingDays",
                (SELECT COUNT(*)::int FROM day_att x WHERE x.employee_id = emp.id) AS "daysPresent",
                (SELECT COUNT(*)::int FROM day_att x
                  WHERE x.employee_id = emp.id AND x.first_status = 'late') AS "lateDays",
                (SELECT COUNT(*)::int FROM day_att x, policy p
                  WHERE x.employee_id = emp.id AND x.minutes >= p.half_day_minutes
                    AND x.minutes < p.full_day_minutes) AS "halfDays",
                (SELECT COUNT(*)::int FROM leave_days x WHERE x.employee_id = emp.id) AS "onLeaveDays",
                (SELECT COUNT(*)::int FROM edays ed
                  WHERE ed.employee_id = emp.id
                    AND NOT EXISTS (SELECT 1 FROM day_att da WHERE da.employee_id = ed.employee_id AND da.d = ed.d)
                    AND NOT EXISTS (SELECT 1 FROM leave_days ld WHERE ld.employee_id = ed.employee_id AND ld.d = ed.d)
                ) AS "absentDays",
                ROUND((SELECT COALESCE(SUM(x.minutes), 0) FROM day_att x WHERE x.employee_id = emp.id) / 60.0, 1)::float
                  AS "totalHours"
           FROM emp JOIN departments dept ON dept.id = emp.department_id
          ORDER BY emp.employee_code, emp.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: total.rows[0]?.total ?? 0 };
    },
  };
  return definition;
}

export function registerAttendanceReports(
  registry: ReportRegistry,
  deps: AttendanceReportDeps,
): void {
  registry.register(attendanceSummaryReport(deps));
}
