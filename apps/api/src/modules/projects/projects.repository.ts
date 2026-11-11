import type { PoolClient } from 'pg';
import { conflict } from '../../http/errors';
import type { ScopeFilter } from '../rbac';
import {
  MilestoneValues,
  NewMilestone,
  NewProject,
  NewProjectDocument,
  NewProjectUpdate,
  PoolGetter,
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectDocumentCategory,
  ProjectMember,
  ProjectMilestone,
  ProjectPriority,
  ProjectSortOption,
  ProjectsSummary,
  ProjectTx,
  ProjectUpdate,
  ProjectUpdateType,
  ProjectValues,
  ProjectWorkflowStatus,
  StoredProjectDocument,
} from './projects.types';

export interface ListProjectsParams {
  /** `all` sees every project; `own` the ones the employee owns or belongs to; anything else none. */
  filter: ScopeFilter;
  status?: 'active' | 'archived';
  workflowStatus?: ProjectWorkflowStatus;
  priority?: ProjectPriority;
  sort?: ProjectSortOption;
  q?: string;
  offset: number;
  limit: number;
}

export interface IProjectsRepository {
  transaction<T>(work: (tx: ProjectTx) => Promise<T>): Promise<T>;
  list(params: ListProjectsParams): Promise<{
    items: Project[];
    total: number;
    summary: ProjectsSummary;
  }>;
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
  /** Milestones */
  insertMilestone(tx: ProjectTx, input: NewMilestone): Promise<ProjectMilestone>;
  findMilestone(
    tx: ProjectTx,
    projectId: string,
    milestoneId: string,
  ): Promise<ProjectMilestone | null>;
  updateMilestone(
    tx: ProjectTx,
    milestoneId: string,
    values: MilestoneValues,
  ): Promise<ProjectMilestone>;
  /** Updates / comments / activity history */
  insertUpdate(tx: ProjectTx, input: NewProjectUpdate): Promise<ProjectUpdate>;
  updateProgress(
    tx: ProjectTx,
    projectId: string,
    progressPercent: number,
    workflowStatus?: ProjectWorkflowStatus,
  ): Promise<void>;
  /** Documents */
  hasDocumentWithHash(projectId: string, sha256: string): Promise<boolean>;
  insertDocument(tx: ProjectTx, input: NewProjectDocument): Promise<StoredProjectDocument>;
  findDocument(projectId: string, documentId: string): Promise<StoredProjectDocument | null>;
  deleteDocument(tx: ProjectTx, documentId: string): Promise<void>;
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
  priority: ProjectPriority;
  workflow_status: ProjectWorkflowStatus;
  progress_percent: number;
  objectives: string | null;
  scope: string | null;
  technologies: unknown;
  owner_employee_id: string;
  owner_name: string;
  owner_email: string | null;
  owner_designation: string | null;
  owner_department: string | null;
  start_date: string | null;
  end_date: string | null;
  version: number;
  member_count: string;
  created_at: Date;
  updated_at: Date;
}

const parseTech = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];

const toProject = (row: Row): Project => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  status: row.status,
  priority: row.priority,
  workflowStatus: row.workflow_status,
  progressPercent: row.progress_percent,
  objectives: row.objectives,
  scope: row.scope,
  technologies: parseTech(row.technologies),
  ownerEmployeeId: row.owner_employee_id,
  ownerName: row.owner_name,
  ownerEmail: row.owner_email,
  ownerDesignation: row.owner_designation,
  ownerDepartment: row.owner_department,
  startDate: row.start_date,
  endDate: row.end_date,
  version: row.version,
  memberCount: Number(row.member_count),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  status: ProjectWorkflowStatus;
  completion_percent: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

const toMilestone = (row: MilestoneRow): ProjectMilestone => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description,
  startDate: row.start_date,
  dueDate: row.due_date,
  status: row.status,
  completionPercent: row.completion_percent,
  sortOrder: row.sort_order,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

interface UpdateRow {
  id: string;
  project_id: string;
  author_employee_id: string;
  author_name: string;
  author_designation: string | null;
  update_type: ProjectUpdateType;
  content: string;
  progress_percent: number | null;
  created_at: Date;
}

const toUpdate = (row: UpdateRow): ProjectUpdate => ({
  id: row.id,
  projectId: row.project_id,
  authorEmployeeId: row.author_employee_id,
  authorName: row.author_name,
  authorRoleLabel: row.author_designation,
  updateType: row.update_type,
  content: row.content,
  progressPercent: row.progress_percent,
  createdAt: row.created_at.toISOString(),
});

interface DocumentRow {
  id: string;
  project_id: string;
  uploaded_by_employee_id: string;
  uploaded_by_name: string;
  storage_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  category: ProjectDocumentCategory;
  created_at: Date;
}

const toDocument = (row: DocumentRow): StoredProjectDocument => ({
  id: row.id,
  projectId: row.project_id,
  uploadedByEmployeeId: row.uploaded_by_employee_id,
  uploadedByName: row.uploaded_by_name,
  storageKey: row.storage_key,
  originalName: row.original_name,
  contentType: row.content_type,
  size: row.size_bytes,
  category: row.category,
  createdAt: row.created_at.toISOString(),
});

// DATE columns are read as text so the driver does not turn them into local-midnight Dates.
const SELECT = `
  SELECT p.id, p.code, p.name, p.description, p.status,
         p.priority, p.workflow_status, p.progress_percent,
         p.objectives, p.scope, p.technologies,
         p.owner_employee_id,
         o.first_name || ' ' || o.last_name AS owner_name,
         o.email AS owner_email,
         od.title AS owner_designation,
         odep.name AS owner_department,
         p.start_date::text AS start_date, p.end_date::text AS end_date, p.version,
         (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
         p.created_at, p.updated_at
    FROM projects p
    JOIN employees o ON o.id = p.owner_employee_id
    LEFT JOIN designations od ON od.id = o.designation_id
    LEFT JOIN departments odep ON odep.id = o.department_id`;

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

function orderByClause(sort?: ProjectSortOption): string {
  switch (sort) {
    case 'deadline_asc':
      return 'p.status, p.end_date ASC NULLS LAST, p.name, p.id';
    case 'deadline_desc':
      return 'p.status, p.end_date DESC NULLS LAST, p.name, p.id';
    case 'name':
    default:
      return 'p.status, p.name, p.id';
  }
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

  async list(params: ListProjectsParams): Promise<{
    items: Project[];
    total: number;
    summary: ProjectsSummary;
  }> {
    const scope = visibility(params.filter, 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;
    if (params.status) {
      values.push(params.status);
      where += ` AND p.status = $${values.length}`;
    }
    if (params.workflowStatus) {
      values.push(params.workflowStatus);
      where += ` AND p.workflow_status = $${values.length}`;
    }
    if (params.priority) {
      values.push(params.priority);
      where += ` AND p.priority = $${values.length}`;
    }
    if (params.q) {
      values.push(`%${params.q.replace(/[\\%_]/g, '\\$&')}%`);
      where += ` AND (p.name ILIKE $${values.length} OR p.code ILIKE $${values.length})`;
    }

    const [totalRes, summaryRes] = await Promise.all([
      this.getPool().query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM projects p WHERE ${where}`,
        values,
      ),
      this.getPool().query<{
        total_assigned: string;
        in_progress: string;
        completed: string;
        upcoming: string;
        on_hold: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE p.status = 'active') AS total_assigned,
           COUNT(*) FILTER (WHERE p.status = 'active' AND p.workflow_status = 'in_progress') AS in_progress,
           COUNT(*) FILTER (WHERE p.status = 'active' AND p.workflow_status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE p.status = 'active' AND p.workflow_status = 'not_started') AS upcoming,
           COUNT(*) FILTER (WHERE p.status = 'active' AND p.workflow_status = 'on_hold') AS on_hold
         FROM projects p
         WHERE ${scope.clause}`,
        scope.values,
      ),
    ]);

    values.push(params.limit, params.offset);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE ${where} ORDER BY ${orderByClause(params.sort)}
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const sumRow = summaryRes.rows[0];
    return {
      items: res.rows.map(toProject),
      total: Number(totalRes.rows[0]?.count ?? 0),
      summary: {
        totalAssigned: Number(sumRow?.total_assigned ?? 0),
        inProgress: Number(sumRow?.in_progress ?? 0),
        completed: Number(sumRow?.completed ?? 0),
        upcoming: Number(sumRow?.upcoming ?? 0),
        onHold: Number(sumRow?.on_hold ?? 0),
      },
    };
  }

  async findDetail(id: string, filter: ScopeFilter): Promise<ProjectDetail | null> {
    const scope = visibility(filter, 2);
    const res = await this.getPool().query<Row>(`${SELECT} WHERE p.id = $1 AND ${scope.clause}`, [
      id,
      ...scope.values,
    ]);
    if (!res.rows[0]) return null;

    const [membersRes, milestonesRes, updatesRes, documentsRes] = await Promise.all([
      this.getPool().query<{
        employee_id: string;
        name: string;
        email: string | null;
        designation: string | null;
        department: string | null;
        added_at: Date;
      }>(
        `SELECT m.employee_id,
                e.first_name || ' ' || e.last_name AS name,
                e.email,
                d.title AS designation,
                dep.name AS department,
                m.added_at
           FROM project_members m
           JOIN employees e ON e.id = m.employee_id
           LEFT JOIN designations d ON d.id = e.designation_id
           LEFT JOIN departments dep ON dep.id = e.department_id
          WHERE m.project_id = $1
          ORDER BY name, m.employee_id`,
        [id],
      ),
      this.getPool().query<MilestoneRow>(
        `SELECT id, project_id, title, description,
                start_date::text AS start_date, due_date::text AS due_date,
                status, completion_percent, sort_order, created_at, updated_at
           FROM project_milestones
          WHERE project_id = $1
          ORDER BY sort_order ASC, due_date ASC NULLS LAST, id ASC`,
        [id],
      ),
      this.getPool().query<UpdateRow>(
        `SELECT u.id, u.project_id, u.author_employee_id,
                e.first_name || ' ' || e.last_name AS author_name,
                d.title AS author_designation,
                u.update_type, u.content, u.progress_percent, u.created_at
           FROM project_updates u
           JOIN employees e ON e.id = u.author_employee_id
           LEFT JOIN designations d ON d.id = e.designation_id
          WHERE u.project_id = $1
          ORDER BY u.created_at DESC, u.id DESC
          LIMIT 100`,
        [id],
      ),
      this.getPool().query<DocumentRow>(
        `SELECT doc.id, doc.project_id, doc.uploaded_by_employee_id,
                e.first_name || ' ' || e.last_name AS uploaded_by_name,
                doc.storage_key, doc.original_name, doc.content_type, doc.size_bytes,
                doc.category, doc.created_at
           FROM project_documents doc
           JOIN employees e ON e.id = doc.uploaded_by_employee_id
          WHERE doc.project_id = $1
          ORDER BY doc.created_at DESC, doc.id DESC`,
        [id],
      ),
    ]);

    return {
      ...toProject(res.rows[0]),
      members: membersRes.rows.map((m): ProjectMember => ({
        employeeId: m.employee_id,
        name: m.name,
        email: m.email,
        designation: m.designation,
        department: m.department,
        addedAt: m.added_at.toISOString(),
      })),
      milestones: milestonesRes.rows.map(toMilestone),
      updates: updatesRes.rows.map(toUpdate),
      documents: documentsRes.rows
        .map(({ storage_key: _key, ...doc }) => toDocument({ ...doc, storage_key: _key }))
        .map(({ storageKey: _k, ...pub }) => pub),
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
        `INSERT INTO projects (
           code, name, description, owner_employee_id, start_date, end_date,
           priority, workflow_status, progress_percent, objectives, scope, technologies
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
         RETURNING id`,
        [
          input.code,
          input.name,
          input.description,
          input.ownerEmployeeId,
          input.startDate,
          input.endDate,
          input.priority ?? 'medium',
          input.workflowStatus ?? 'in_progress',
          input.progressPercent ?? 0,
          input.objectives ?? null,
          input.scope ?? null,
          JSON.stringify(input.technologies ?? []),
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
              priority = $7, workflow_status = $8, progress_percent = $9,
              objectives = $10, scope = $11, technologies = $12::jsonb,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      [
        id,
        values.name,
        values.description,
        values.status,
        values.startDate,
        values.endDate,
        values.priority,
        values.workflowStatus,
        values.progressPercent,
        values.objectives,
        values.scope,
        JSON.stringify(values.technologies),
      ],
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

  async insertMilestone(tx: ProjectTx, input: NewMilestone): Promise<ProjectMilestone> {
    const nextOrder = await tx.query<{ max_order: string }>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS max_order FROM project_milestones WHERE project_id = $1`,
      [input.projectId],
    );
    const sortOrder = Number(nextOrder.rows[0]?.max_order ?? 1);
    const res = await tx.query<MilestoneRow>(
      `INSERT INTO project_milestones (
         project_id, title, description, start_date, due_date, status, completion_percent, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id, title, description, start_date::text AS start_date,
                 due_date::text AS due_date, status, completion_percent, sort_order, created_at, updated_at`,
      [
        input.projectId,
        input.title,
        input.description,
        input.startDate,
        input.dueDate,
        input.status,
        input.completionPercent,
        sortOrder,
      ],
    );
    return toMilestone(res.rows[0] as MilestoneRow);
  }

  async findMilestone(
    tx: ProjectTx,
    projectId: string,
    milestoneId: string,
  ): Promise<ProjectMilestone | null> {
    const res = await tx.query<MilestoneRow>(
      `SELECT id, project_id, title, description, start_date::text AS start_date,
              due_date::text AS due_date, status, completion_percent, sort_order, created_at, updated_at
         FROM project_milestones
        WHERE project_id = $1 AND id = $2
        FOR UPDATE`,
      [projectId, milestoneId],
    );
    return res.rows[0] ? toMilestone(res.rows[0]) : null;
  }

  async updateMilestone(
    tx: ProjectTx,
    milestoneId: string,
    values: MilestoneValues,
  ): Promise<ProjectMilestone> {
    const res = await tx.query<MilestoneRow>(
      `UPDATE project_milestones
          SET title = $2, description = $3, start_date = $4, due_date = $5,
              status = $6, completion_percent = $7, updated_at = NOW()
        WHERE id = $1
        RETURNING id, project_id, title, description, start_date::text AS start_date,
                  due_date::text AS due_date, status, completion_percent, sort_order, created_at, updated_at`,
      [
        milestoneId,
        values.title,
        values.description,
        values.startDate,
        values.dueDate,
        values.status,
        values.completionPercent,
      ],
    );
    return toMilestone(res.rows[0] as MilestoneRow);
  }

  async insertUpdate(tx: ProjectTx, input: NewProjectUpdate): Promise<ProjectUpdate> {
    const res = await tx.query<UpdateRow>(
      `WITH inserted AS (
         INSERT INTO project_updates (project_id, author_employee_id, update_type, content, progress_percent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, project_id, author_employee_id, update_type, content, progress_percent, created_at
       )
       SELECT i.id, i.project_id, i.author_employee_id,
              e.first_name || ' ' || e.last_name AS author_name,
              d.title AS author_designation,
              i.update_type, i.content, i.progress_percent, i.created_at
         FROM inserted i
         JOIN employees e ON e.id = i.author_employee_id
         LEFT JOIN designations d ON d.id = e.designation_id`,
      [
        input.projectId,
        input.authorEmployeeId,
        input.updateType,
        input.content,
        input.progressPercent,
      ],
    );
    return toUpdate(res.rows[0] as UpdateRow);
  }

  async updateProgress(
    tx: ProjectTx,
    projectId: string,
    progressPercent: number,
    workflowStatus?: ProjectWorkflowStatus,
  ): Promise<void> {
    await tx.query(
      `UPDATE projects
          SET progress_percent = $2,
              workflow_status = COALESCE($3, workflow_status),
              updated_at = NOW()
        WHERE id = $1`,
      [projectId, progressPercent, workflowStatus ?? null],
    );
  }

  async hasDocumentWithHash(projectId: string, sha256: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM project_documents WHERE project_id = $1 AND sha256 = $2 LIMIT 1`,
      [projectId, sha256],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insertDocument(tx: ProjectTx, input: NewProjectDocument): Promise<StoredProjectDocument> {
    const res = await tx.query<DocumentRow>(
      `WITH inserted AS (
         INSERT INTO project_documents (
           project_id, uploaded_by_employee_id, storage_key, original_name,
           content_type, size_bytes, sha256, category
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, project_id, uploaded_by_employee_id, storage_key, original_name,
                   content_type, size_bytes, category, created_at
       )
       SELECT i.id, i.project_id, i.uploaded_by_employee_id,
              e.first_name || ' ' || e.last_name AS uploaded_by_name,
              i.storage_key, i.original_name, i.content_type, i.size_bytes,
              i.category, i.created_at
         FROM inserted i
         JOIN employees e ON e.id = i.uploaded_by_employee_id`,
      [
        input.projectId,
        input.uploadedByEmployeeId,
        input.storageKey,
        input.originalName,
        input.contentType,
        input.size,
        input.sha256,
        input.category,
      ],
    );
    return toDocument(res.rows[0] as DocumentRow);
  }

  async findDocument(projectId: string, documentId: string): Promise<StoredProjectDocument | null> {
    const res = await this.getPool().query<DocumentRow>(
      `SELECT doc.id, doc.project_id, doc.uploaded_by_employee_id,
              e.first_name || ' ' || e.last_name AS uploaded_by_name,
              doc.storage_key, doc.original_name, doc.content_type, doc.size_bytes,
              doc.category, doc.created_at
         FROM project_documents doc
         JOIN employees e ON e.id = doc.uploaded_by_employee_id
        WHERE doc.project_id = $1 AND doc.id = $2`,
      [projectId, documentId],
    );
    return res.rows[0] ? toDocument(res.rows[0]) : null;
  }

  async deleteDocument(tx: ProjectTx, documentId: string): Promise<void> {
    await tx.query(`DELETE FROM project_documents WHERE id = $1`, [documentId]);
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
