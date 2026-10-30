import type { Pool, PoolClient } from 'pg';
import { ScopeFilter, scopeToSql } from '../rbac';
import {
  Approval,
  ApprovalDecision,
  ApprovalOutcome,
  ApprovalStage,
  ApprovalStatus,
  ApprovalTx,
  RequesterContext,
  SubmitApprovalInput,
} from './approvals.types';

export interface FindApprovalsParams {
  filter: ScopeFilter;
  status?: ApprovalStatus;
  subjectType?: string;
  /** Set for `awaitingMyDecision`: the caller and whether they may decide the `hr` stage. */
  awaiting?: { employeeId: string; hr: boolean };
  offset: number;
  limit: number;
}

export interface SaveDecisionInput {
  stage: number;
  deciderEmployeeId: string;
  outcome: ApprovalOutcome;
  comment: string | null;
  status: ApprovalStatus;
  nextStage: number;
}

export interface IApprovalsRepository {
  transaction<T>(work: (tx: ApprovalTx) => Promise<T>): Promise<T>;
  getRequesterContext(tx: ApprovalTx, employeeId: string): Promise<RequesterContext | null>;
  insert(tx: ApprovalTx, input: SubmitApprovalInput): Promise<Approval>;
  /** Reads one approval inside the caller's scope; null when it is missing or out of scope. */
  findById(id: string, filter: ScopeFilter): Promise<Approval | null>;
  findMany(params: FindApprovalsParams): Promise<{ items: Approval[]; total: number }>;
  /** Locks the row until the transaction ends, so concurrent decisions on it run one at a time. */
  lockById(tx: ApprovalTx, id: string): Promise<Approval | null>;
  lockBySubject(tx: ApprovalTx, subjectType: string, subjectId: string): Promise<Approval | null>;
  saveDecision(tx: ApprovalTx, id: string, input: SaveDecisionInput): Promise<Approval>;
  markCancelled(tx: ApprovalTx, id: string): Promise<Approval>;
}

interface ApprovalRow {
  id: string;
  subject_type: string;
  subject_id: string;
  requester_employee_id: string;
  requester_name: string;
  requester_manager_id: string | null;
  stages: ApprovalStage[];
  current_stage: number;
  status: ApprovalStatus;
  decisions: Array<{
    stage: number;
    decidedByEmployeeId: string;
    outcome: ApprovalOutcome;
    comment: string | null;
    decidedAt: string;
  }>;
  created_at: Date | string;
  decided_at: Date | string | null;
}

const iso = (value: Date | string): string => new Date(value).toISOString();

const toApproval = (row: ApprovalRow): Approval => ({
  id: row.id,
  subjectType: row.subject_type,
  subjectId: row.subject_id,
  requesterEmployeeId: row.requester_employee_id,
  requesterName: row.requester_name,
  requesterManagerId: row.requester_manager_id,
  stages: row.stages,
  currentStage: row.current_stage,
  status: row.status,
  decisions: row.decisions.map((d): ApprovalDecision => ({ ...d, decidedAt: iso(d.decidedAt) })),
  createdAt: iso(row.created_at),
  decidedAt: row.decided_at ? iso(row.decided_at) : null,
});

const SELECT = `
  SELECT a.id, a.subject_type, a.subject_id, a.requester_employee_id,
         TRIM(CONCAT(r.first_name, ' ', r.last_name)) AS requester_name,
         r.manager_id AS requester_manager_id,
         a.stages, a.current_stage, a.status, a.created_at, a.decided_at,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'stage', d.stage,
                    'decidedByEmployeeId', d.decided_by_employee_id,
                    'outcome', d.outcome,
                    'comment', d.comment,
                    'decidedAt', d.decided_at) ORDER BY d.stage)
             FROM approval_decisions d WHERE d.approval_id = a.id
         ), '[]'::json) AS decisions
    FROM approvals a
    JOIN employees r ON r.id = a.requester_employee_id`;

export class PgApprovalsRepository implements IApprovalsRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: ApprovalTx) => Promise<T>): Promise<T> {
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

  async getRequesterContext(tx: ApprovalTx, employeeId: string) {
    const res = await tx.query<{ manager_id: string | null; roles: string[] }>(
      `SELECT e.manager_id,
              COALESCE(array_agg(ro.key) FILTER (WHERE ro.key IS NOT NULL), '{}') AS roles
         FROM employees e
         LEFT JOIN users u ON u.employee_id = e.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles ro ON ro.id = ur.role_id
        WHERE e.id = $1
        GROUP BY e.id`,
      [employeeId],
    );
    const row = res.rows[0];
    return row
      ? { managerId: row.manager_id, roles: row.roles as RequesterContext['roles'] }
      : null;
  }

  async insert(tx: ApprovalTx, input: SubmitApprovalInput): Promise<Approval> {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages)
       VALUES ($1, $2, $3, $4::text[]) RETURNING id`,
      [input.subjectType, input.subjectId, input.requesterEmployeeId, input.stages],
    );
    return this.load(tx, res.rows[0]?.id ?? '');
  }

  async findById(id: string, filter: ScopeFilter): Promise<Approval | null> {
    const scope = scopeToSql(filter, 'a.requester_employee_id', 2);
    const res = await this.getPool().query<ApprovalRow>(
      `${SELECT} WHERE a.id = $1 AND ${scope.clause}`,
      [id, ...scope.values],
    );
    return res.rows[0] ? toApproval(res.rows[0]) : null;
  }

  async findMany(params: FindApprovalsParams) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const param = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    const scope = scopeToSql(params.filter, 'a.requester_employee_id', values.length + 1);
    values.push(...scope.values);
    conditions.push(scope.clause);
    if (params.status) conditions.push(`a.status = ${param(params.status)}`);
    if (params.subjectType) conditions.push(`a.subject_type = ${param(params.subjectType)}`);
    if (params.awaiting) {
      const me = param(params.awaiting.employeeId);
      const hr = param(params.awaiting.hr);
      conditions.push(
        `a.status = 'pending' AND a.requester_employee_id <> ${me}
         AND NOT EXISTS (SELECT 1 FROM approval_decisions d
                          WHERE d.approval_id = a.id AND d.decided_by_employee_id = ${me})
         AND ((a.stages[a.current_stage + 1] = 'manager' AND r.manager_id = ${me})
           OR (a.stages[a.current_stage + 1] = 'hr' AND ${hr}::boolean))`,
      );
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const count = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM approvals a JOIN employees r ON r.id = a.requester_employee_id ${where}`,
      values,
    );
    const paging = [...values, params.limit, params.offset];
    // Oldest first: the person who has waited longest is at the top of the inbox.
    const res = await this.getPool().query<ApprovalRow>(
      `${SELECT} ${where}
        ORDER BY a.created_at ASC, a.id ASC
        LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
      paging,
    );
    return { items: res.rows.map(toApproval), total: count.rows[0]?.count ?? 0 };
  }

  async lockById(tx: ApprovalTx, id: string): Promise<Approval | null> {
    await tx.query(`SELECT id FROM approvals WHERE id = $1 FOR UPDATE`, [id]);
    return this.loadOrNull(tx, id);
  }

  async lockBySubject(tx: ApprovalTx, subjectType: string, subjectId: string) {
    const res = await tx.query<{ id: string }>(
      `SELECT id FROM approvals WHERE subject_type = $1 AND subject_id = $2 FOR UPDATE`,
      [subjectType, subjectId],
    );
    return res.rows[0] ? this.loadOrNull(tx, res.rows[0].id) : null;
  }

  async saveDecision(tx: ApprovalTx, id: string, input: SaveDecisionInput): Promise<Approval> {
    await tx.query(
      `INSERT INTO approval_decisions (approval_id, stage, decided_by_employee_id, outcome, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.stage, input.deciderEmployeeId, input.outcome, input.comment],
    );
    await tx.query(
      `UPDATE approvals
          SET status = $2::varchar, current_stage = $3, updated_at = NOW(),
              decided_at = CASE WHEN $2::varchar = 'pending' THEN NULL ELSE NOW() END
        WHERE id = $1`,
      [id, input.status, input.nextStage],
    );
    return this.load(tx, id);
  }

  async markCancelled(tx: ApprovalTx, id: string): Promise<Approval> {
    await tx.query(
      `UPDATE approvals SET status = 'cancelled', decided_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return this.load(tx, id);
  }

  private async loadOrNull(db: ApprovalTx, id: string): Promise<Approval | null> {
    const res = await db.query<ApprovalRow>(`${SELECT} WHERE a.id = $1`, [id]);
    return res.rows[0] ? toApproval(res.rows[0]) : null;
  }

  private async load(db: ApprovalTx, id: string): Promise<Approval> {
    const approval = await this.loadOrNull(db, id);
    if (!approval) throw new Error(`Approval ${id} vanished inside its transaction`);
    return approval;
  }
}
