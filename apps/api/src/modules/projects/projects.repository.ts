import type { PoolClient } from 'pg';
import { conflict } from '../../http/errors';
import type { ScopeFilter } from '../rbac';
import {
  NewProject,
  PoolGetter,
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectMember,
  ProjectTx,
  ProjectValues,
} from './projects.types';

export interface ListProjectsParams {
  /** `all` sees every project; `own` the ones the employee owns or belongs to; anything else none. */
  filter: ScopeFilter;
  status?: 'active' | 'archived';
  q?: string;
  offset: number;
  limit: number;
}

export interface IProjectsRepository {
  transaction<T>(work: (tx: ProjectTx) => Promise<T>): Promise<T>;
  list(params: ListProjectsParams): Promise<{ items: Project[]; total: number }>;
  /** Only when the project is visible inside `filter`. */
  findDetail(id: string, filter: ScopeFilter): Promise<ProjectDetail | null>;
  /** Locks the project row until the transaction ends. */
  lockForUpdate(tx: ProjectTx, id: string): Promise<Project | null>;
  /** A 409 when the code is taken. Returns the new id. */
  insert(tx: ProjectTx, input: NewProject): Promise<string>;
  /** Writes the new values and bumps the version. */
  update(tx: ProjectTx, id: string, values: ProjectValues): Promise<void>;
  /** Adds members; ones already in are left alone. */
  addMembers(tx: ProjectTx, projectId: string, employeeIds: string[]): Promise<number>;
  removeMember(tx: ProjectTx, projectId: string, employeeId: string): Promise<boolean>;
  /** Whether the employee is active and holds the Team Lead or Admin role. */
  isEligibleOwner(tx: ProjectTx, employeeId: string): Promise<boolean>;
  /** The ids that cannot be members under this owner: not active, or neither the owner nor a direct report. */
  ineligibleMembers(tx: ProjectTx, ownerId: string, employeeIds: string[]): Promise<string[]>;
  access(projectId: string): Promise<ProjectAccess | null>;
}

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  owner_employee_id: string;
  owner_name: string;
  start_date: string | null;
  end_date: string | null;
  version: number;
  member_count: string;
  created_at: Date;
  updated_at: Date;
}

const toProject = (row: Row): Project => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  status: row.status,
  ownerEmployeeId: row.owner_employee_id,
  ownerName: row.owner_name,
  startDate: row.start_date,
  endDate: row.end_date,
  version: row.version,
  memberCount: Number(row.member_count),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// DATE columns are read as text so the driver does not turn them into local-midnight Dates.
const SELECT = `
  SELECT p.id, p.code, p.name, p.description, p.status, p.owner_employee_id,
         o.first_name || ' ' || o.last_name AS owner_name,
         p.start_date::text AS start_date, p.end_date::text AS end_date, p.version,
         (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
         p.created_at, p.updated_at
    FROM projects p
    JOIN employees o ON o.id = p.owner_employee_id`;

/** The visibility rule as SQL; `firstParam` is where its parameter (if any) is numbered. */
function visibility(filter: ScopeFilter, firstParam: number): { clause: string; values: string[] } {
  if (filter.kind === 'all') return { clause: 'TRUE', values: [] };
  if (filter.kind !== 'own') return { clause: 'FALSE', values: [] };
  return {
    clause: `(p.owner_employee_id = $${firstParam}
              OR EXISTS (SELECT 1 FROM project_members v
                          WHERE v.project_id = p.id AND v.employee_id = $${firstParam}))`,
    values: [filter.employeeId],
  };
}

export class PgProjectsRepository implements IProjectsRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: ProjectTx) => Promise<T>): Promise<T> {
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

  async list(params: ListProjectsParams): Promise<{ items: Project[]; total: number }> {
    const scope = visibility(params.filter, 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;
    if (params.status) {
      values.push(params.status);
      where += ` AND p.status = $${values.length}`;
    }
    if (params.q) {
      values.push(`%${params.q.replace(/[\\%_]/g, '\\$&')}%`);
      where += ` AND (p.name ILIKE $${values.length} OR p.code ILIKE $${values.length})`;
    }
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM projects p WHERE ${where}`,
      values,
    );
    values.push(params.limit, params.offset);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE ${where} ORDER BY p.status, p.name, p.id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: res.rows.map(toProject), total: Number(total.rows[0]?.count ?? 0) };
  }

  async findDetail(id: string, filter: ScopeFilter): Promise<ProjectDetail | null> {
    const scope = visibility(filter, 2);
    const res = await this.getPool().query<Row>(`${SELECT} WHERE p.id = $1 AND ${scope.clause}`, [
      id,
      ...scope.values,
    ]);
    if (!res.rows[0]) return null;
    const members = await this.getPool().query<{
      employee_id: string;
      name: string;
      added_at: Date;
    }>(
      `SELECT m.employee_id, e.first_name || ' ' || e.last_name AS name, m.added_at
         FROM project_members m JOIN employees e ON e.id = m.employee_id
        WHERE m.project_id = $1 ORDER BY name, m.employee_id`,
      [id],
    );
    return {
      ...toProject(res.rows[0]),
      members: members.rows.map((m): ProjectMember => ({
        employeeId: m.employee_id,
        name: m.name,
        addedAt: m.added_at.toISOString(),
      })),
    };
  }

  async lockForUpdate(tx: ProjectTx, id: string): Promise<Project | null> {
    const locked = await tx.query(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [id]);
    if (locked.rowCount === 0) return null;
    const res = await tx.query<Row>(`${SELECT} WHERE p.id = $1`, [id]);
    return res.rows[0] ? toProject(res.rows[0]) : null;
  }

  async insert(tx: ProjectTx, input: NewProject): Promise<string> {
    try {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO projects (code, name, description, owner_employee_id, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          input.code,
          input.name,
          input.description,
          input.ownerEmployeeId,
          input.startDate,
          input.endDate,
        ],
      );
      return (res.rows[0] as { id: string }).id;
    } catch (err) {
      if ((err as { code?: string }).code === '23505')
        throw conflict('A project with this code already exists');
      throw err;
    }
  }

  async update(tx: ProjectTx, id: string, values: ProjectValues): Promise<void> {
    await tx.query(
      `UPDATE projects
          SET name = $2, description = $3, status = $4, start_date = $5, end_date = $6,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      [id, values.name, values.description, values.status, values.startDate, values.endDate],
    );
  }

  async addMembers(tx: ProjectTx, projectId: string, employeeIds: string[]): Promise<number> {
    if (employeeIds.length === 0) return 0;
    const res = await tx.query(
      `INSERT INTO project_members (project_id, employee_id)
       SELECT $1, UNNEST($2::uuid[]) ON CONFLICT DO NOTHING`,
      [projectId, employeeIds],
    );
    return res.rowCount ?? 0;
  }

  async removeMember(tx: ProjectTx, projectId: string, employeeId: string): Promise<boolean> {
    const res = await tx.query(
      `DELETE FROM project_members WHERE project_id = $1 AND employee_id = $2`,
      [projectId, employeeId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async isEligibleOwner(tx: ProjectTx, employeeId: string): Promise<boolean> {
    const res = await tx.query(
      `SELECT 1 FROM employees e
         JOIN users u ON u.employee_id = e.id AND u.is_active
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.key IN ('team_lead', 'admin')
        WHERE e.id = $1 AND e.status = 'active' LIMIT 1 FOR SHARE OF e`,
      [employeeId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async ineligibleMembers(
    tx: ProjectTx,
    ownerId: string,
    employeeIds: string[],
  ): Promise<string[]> {
    if (employeeIds.length === 0) return [];
    const ok = await tx.query<{ id: string }>(
      `SELECT id FROM employees
        WHERE id = ANY($1::uuid[]) AND status = 'active' AND (id = $2 OR manager_id = $2)
        FOR SHARE`,
      [employeeIds, ownerId],
    );
    const eligible = new Set(ok.rows.map((row) => row.id));
    return employeeIds.filter((id) => !eligible.has(id));
  }

  async access(projectId: string): Promise<ProjectAccess | null> {
    const project = await this.getPool().query<{ status: 'active' | 'archived'; owner: string }>(
      `SELECT status, owner_employee_id AS owner FROM projects WHERE id = $1`,
      [projectId],
    );
    if (!project.rows[0]) return null;
    const members = await this.getPool().query<{ employee_id: string }>(
      `SELECT employee_id FROM project_members WHERE project_id = $1`,
      [projectId],
    );
    return {
      status: project.rows[0].status,
      ownerEmployeeId: project.rows[0].owner,
      memberEmployeeIds: members.rows.map((row) => row.employee_id),
    };
  }
}
