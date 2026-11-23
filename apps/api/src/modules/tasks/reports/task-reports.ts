import type { Pool } from 'pg';
import { z } from 'zod';
import { ReportDefinition, ReportRegistry } from '../../reports';
import { assertRange, companyDate, isoDate } from '../../reports/report-filters';
import { scopeToSql } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';

export interface TaskReportDeps {
  getPool: () => Pool;
  settings: CompanySettingsReader;
  clock?: () => Date;
}

const MAX_TASK_RANGE_DAYS = 366;

/**
 * Tasks per assignee by status (D-14), with how many are overdue on the company calendar. A
 * Team Lead's report holds their direct reports; an Admin's everyone. Optional filters narrow it
 * to one project or to tasks due in a range.
 */
export function taskStatusReport(deps: TaskReportDeps) {
  const filters = z
    .object({
      projectId: z.string().uuid().optional(),
      dueFrom: isoDate.optional(),
      dueTo: isoDate.optional(),
    })
    .strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'task-status',
    title: 'Tasks by status',
    description: 'Open, in review, blocked, completed and overdue tasks per assignee',
    module: 'tasks',
    dataPermissions: ['tasks.read_team'],
    filters,
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'todo', label: 'To do' },
      { key: 'inProgress', label: 'In progress' },
      { key: 'inReview', label: 'In review' },
      { key: 'blocked', label: 'Blocked' },
      { key: 'completed', label: 'Completed' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'total', label: 'Total' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      if (f.dueFrom && f.dueTo) assertRange(f.dueFrom, f.dueTo, MAX_TASK_RANGE_DAYS);
      const { timezone } = await deps.settings.getBasic();
      const today = companyDate((deps.clock ?? (() => new Date()))(), timezone);
      const values: unknown[] = [];
      const add = (value: unknown) => {
        values.push(value);
        return `$${values.length}`;
      };
      const scoped = scopeToSql(scope, 't.assignee_employee_id', 1);
      values.push(...scoped.values);
      let where = scoped.clause;
      if (f.projectId) where += ` AND t.project_id = ${add(f.projectId)}`;
      if (f.dueFrom) where += ` AND t.due_date >= ${add(f.dueFrom)}::date`;
      if (f.dueTo) where += ` AND t.due_date <= ${add(f.dueTo)}::date`;
      const todayParam = add(today);
      const from = `tasks t JOIN employees e ON e.id = t.assignee_employee_id
          JOIN departments d ON d.id = e.department_id`;
      const total = await deps
        .getPool()
        .query<{ total: number }>(
          `SELECT COUNT(DISTINCT t.assignee_employee_id)::int AS total FROM ${from} WHERE ${where}`,
          values.slice(0, values.length - 1),
        );
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT e.employee_code AS "employeeCode",
                TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "employeeName",
                d.name AS department,
                COUNT(*) FILTER (WHERE t.status = 'todo')::int AS todo,
                COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS "inProgress",
                COUNT(*) FILTER (WHERE t.status = 'in_review')::int AS "inReview",
                COUNT(*) FILTER (WHERE t.status = 'blocked')::int AS blocked,
                COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE t.status <> 'completed' AND t.due_date < ${todayParam}::date)::int AS overdue,
                COUNT(*)::int AS total
           FROM ${from}
          WHERE ${where}
          GROUP BY e.id, e.employee_code, e.first_name, e.last_name, d.name
          ORDER BY e.employee_code, e.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: total.rows[0]?.total ?? 0 };
    },
  };
  return definition;
}

/**
 * Project progress (D-14): members, tasks, how many are completed and overdue, and the share
 * completed. A project is in the report when the caller owns it, belongs to it, or is an Admin.
 */
export function projectStatusReport(deps: TaskReportDeps) {
  const filters = z.object({ status: z.enum(['active', 'archived']).optional() }).strict();
  const definition: ReportDefinition<typeof filters.shape> = {
    name: 'project-status',
    title: 'Project status',
    description: 'Members, tasks, completed and overdue tasks and progress per project',
    module: 'projects',
    dataPermissions: ['projects.read'],
    filters,
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'owner', label: 'Owner' },
      { key: 'members', label: 'Members' },
      { key: 'tasks', label: 'Tasks' },
      { key: 'completed', label: 'Completed' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'percentComplete', label: 'Complete %' },
    ],
    async run({ filters: f, scope, offset, limit }) {
      const { timezone } = await deps.settings.getBasic();
      const today = companyDate((deps.clock ?? (() => new Date()))(), timezone);
      const values: unknown[] = [];
      const add = (value: unknown) => {
        values.push(value);
        return `$${values.length}`;
      };
      // Projects are visible to their owner and members (an Admin sees all), as in the projects API.
      let where: string;
      if (scope.kind === 'all') {
        where = 'TRUE';
      } else if (scope.kind === 'own') {
        const me = add(scope.employeeId);
        where = `(p.owner_employee_id = ${me} OR EXISTS (
                   SELECT 1 FROM project_members v WHERE v.project_id = p.id AND v.employee_id = ${me}))`;
      } else {
        where = 'FALSE';
      }
      if (f.status) where += ` AND p.status = ${add(f.status)}`;
      const base = [...values];
      const todayParam = add(today);
      const total = await deps
        .getPool()
        .query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM projects p WHERE ${where}`,
          base,
        );
      const paging = [...values, limit, offset];
      const res = await deps.getPool().query(
        `SELECT p.code, p.name, p.status, TRIM(CONCAT(o.first_name, ' ', o.last_name)) AS owner,
                (SELECT COUNT(*)::int FROM project_members m WHERE m.project_id = p.id) AS members,
                COUNT(t.id)::int AS tasks,
                COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed,
                COUNT(t.id) FILTER (WHERE t.status <> 'completed' AND t.due_date < ${todayParam}::date)::int AS overdue,
                CASE WHEN COUNT(t.id) = 0 THEN 0
                     ELSE ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.status = 'completed') / COUNT(t.id))::int
                END AS "percentComplete"
           FROM projects p
           JOIN employees o ON o.id = p.owner_employee_id
           LEFT JOIN tasks t ON t.project_id = p.id
          WHERE ${where}
          GROUP BY p.id, o.first_name, o.last_name
          ORDER BY p.status, p.code, p.id
          LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
        paging,
      );
      return { rows: res.rows, total: total.rows[0]?.total ?? 0 };
    },
  };
  return definition;
}

export function registerTaskReports(registry: ReportRegistry, deps: TaskReportDeps): void {
  registry.register(taskStatusReport(deps));
  registry.register(projectStatusReport(deps));
}
