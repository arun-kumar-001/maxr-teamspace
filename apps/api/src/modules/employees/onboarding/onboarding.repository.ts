import type { Pool, PoolClient } from 'pg';
import { DEFAULT_ONBOARDING_ITEMS } from './onboarding.rules';
import {
  ListOnboardingQuery,
  OnboardingChecklistDetail,
  OnboardingChecklistSummary,
  OnboardingItem,
  OnboardingStatus,
  OnboardingStep,
} from './onboarding.types';

export type OnboardingTx = PoolClient;

export interface ScopeFilter {
  role: string;
  callerEmployeeId: string;
  callerUserId: string;
}

export interface IOnboardingRepository {
  transaction<T>(work: (tx: OnboardingTx) => Promise<T>): Promise<T>;
  listChecklists(
    scope: ScopeFilter,
    query: ListOnboardingQuery,
  ): Promise<{ data: OnboardingChecklistSummary[]; total: number }>;
  getChecklistDetail(
    tx: OnboardingTx | null,
    employeeId: string,
  ): Promise<OnboardingChecklistDetail | null>;
  getChecklistDetailByUserId(
    tx: OnboardingTx | null,
    userId: string,
  ): Promise<OnboardingChecklistDetail | null>;
  ensureChecklist(tx: OnboardingTx, employeeId: string): Promise<OnboardingChecklistDetail>;
  findUserByEmployeeId(
    tx: OnboardingTx,
    employeeId: string,
  ): Promise<{ id: string; email: string } | null>;
  lockChecklist(tx: OnboardingTx, employeeId: string): Promise<OnboardingChecklistDetail | null>;
  verifyItem(
    tx: OnboardingTx,
    checklistId: string,
    itemKey: string,
    verifiedBy: string,
    notes?: string,
  ): Promise<OnboardingItem>;
  unverifyItem(tx: OnboardingTx, checklistId: string, itemKey: string): Promise<OnboardingItem>;
  updateChecklistState(
    tx: OnboardingTx,
    checklistId: string,
    step: OnboardingStep,
    status: OnboardingStatus,
    completedAt?: Date | null,
  ): Promise<void>;
  activateAccount(tx: OnboardingTx, employeeId: string): Promise<void>;
  reopenAccount(tx: OnboardingTx, employeeId: string): Promise<{ userId: string }>;
  createSetPasswordToken(
    tx: OnboardingTx,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findValidSetPasswordToken(
    tx: OnboardingTx,
    tokenHash: string,
  ): Promise<{ id: string; userId: string; employeeId: string; email: string } | null>;
  consumeSetPasswordToken(
    tx: OnboardingTx,
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void>;
}

export class PgOnboardingRepository implements IOnboardingRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: OnboardingTx) => Promise<T>): Promise<T> {
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

  private getClient(tx: OnboardingTx | null): PoolClient | Pool {
    return tx ?? this.getPool();
  }

  async listChecklists(
    scope: ScopeFilter,
    query: ListOnboardingQuery,
  ): Promise<{ data: OnboardingChecklistSummary[]; total: number }> {
    const pool = this.getPool();
    const whereParts: string[] = ['1=1'];
    const values: unknown[] = [];
    let pIdx = 1;

    // Scope enforcement in SQL
    if (scope.role === 'staff') {
      whereParts.push(`e.id = $${pIdx++}`);
      values.push(scope.callerEmployeeId);
    } else if (scope.role === 'team_lead') {
      whereParts.push(`(e.manager_id = $${pIdx} OR e.id = $${pIdx})`);
      pIdx++;
      values.push(scope.callerEmployeeId);
    }

    if (query.status) {
      whereParts.push(`c.status = $${pIdx++}`);
      values.push(query.status);
    }

    if (query.step) {
      whereParts.push(`c.current_step = $${pIdx++}`);
      values.push(query.step);
    }

    if (query.departmentId) {
      whereParts.push(`e.department_id = $${pIdx++}`);
      values.push(query.departmentId);
    }

    if (query.search) {
      const pattern = `%${query.search.toLowerCase()}%`;
      whereParts.push(`(
        LOWER(e.first_name) LIKE $${pIdx} OR 
        LOWER(e.last_name) LIKE $${pIdx} OR 
        LOWER(e.employee_code) LIKE $${pIdx} OR 
        LOWER(e.email) LIKE $${pIdx}
      )`);
      pIdx++;
      values.push(pattern);
    }

    const whereClause = whereParts.join(' AND ');

    const countRes = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
         FROM onboarding_checklists c
         JOIN employees e ON e.id = c.employee_id
        WHERE ${whereClause}`,
      values,
    );
    const total = countRes.rows[0]?.total ?? 0;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    values.push(pageSize, offset);

    const rowsRes = await pool.query<{
      id: string;
      employee_id: string;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      department_id: string;
      department_name: string;
      designation_id: string;
      designation_title: string;
      manager_id: string | null;
      joining_date: string;
      employee_status: string;
      user_active: boolean;
      status: OnboardingStatus;
      current_step: OnboardingStep;
      completed_at: Date | null;
      created_at: Date;
      updated_at: Date;
      total_items: number;
      verified_items: number;
    }>(
      `SELECT c.id,
              c.employee_id,
              e.employee_code,
              e.first_name,
              e.last_name,
              e.email,
              e.department_id,
              d.name AS department_name,
              e.designation_id,
              des.title AS designation_title,
              e.manager_id,
              e.joining_date::text AS joining_date,
              e.status AS employee_status,
              COALESCE(u.is_active, false) AS user_active,
              c.status,
              c.current_step,
              c.completed_at,
              c.created_at,
              c.updated_at,
              COUNT(i.id)::int AS total_items,
              COUNT(CASE WHEN i.is_verified THEN 1 END)::int AS verified_items
         FROM onboarding_checklists c
         JOIN employees e ON e.id = c.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN designations des ON des.id = e.designation_id
         LEFT JOIN users u ON u.employee_id = e.id
         LEFT JOIN onboarding_items i ON i.checklist_id = c.id
        WHERE ${whereClause}
        GROUP BY c.id, e.id, d.name, des.title, u.is_active
        ORDER BY c.created_at DESC
        LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      values,
    );

    return {
      data: rowsRes.rows.map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeCode: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        departmentId: r.department_id,
        departmentName: r.department_name ?? '',
        designationId: r.designation_id,
        designationTitle: r.designation_title ?? '',
        managerId: r.manager_id,
        joiningDate: r.joining_date,
        employeeStatus: r.employee_status,
        userActive: r.user_active,
        status: r.status,
        currentStep: r.current_step,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        totalItems: r.total_items,
        verifiedItems: r.verified_items,
      })),
      total,
    };
  }

  async getChecklistDetail(
    tx: OnboardingTx | null,
    employeeId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    const client = this.getClient(tx);

    const checklistRes = await client.query<{
      id: string;
      employee_id: string;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      department_id: string;
      department_name: string;
      designation_id: string;
      designation_title: string;
      manager_id: string | null;
      joining_date: string;
      employee_status: string;
      user_active: boolean;
      status: OnboardingStatus;
      current_step: OnboardingStep;
      completed_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT c.id,
              c.employee_id,
              e.employee_code,
              e.first_name,
              e.last_name,
              e.email,
              e.department_id,
              d.name AS department_name,
              e.designation_id,
              des.title AS designation_title,
              e.manager_id,
              e.joining_date::text AS joining_date,
              e.status AS employee_status,
              COALESCE(u.is_active, false) AS user_active,
              c.status,
              c.current_step,
              c.completed_at,
              c.created_at,
              c.updated_at
         FROM onboarding_checklists c
         JOIN employees e ON e.id = c.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN designations des ON des.id = e.designation_id
         LEFT JOIN users u ON u.employee_id = e.id
        WHERE e.id = $1`,
      [employeeId],
    );

    const checklist = checklistRes.rows[0];
    if (!checklist) return null;

    const itemsRes = await client.query<{
      id: string;
      checklist_id: string;
      step: 'hr' | 'system' | 'it_admin' | 'employee';
      item_key: string;
      title: string;
      description: string | null;
      is_verified: boolean;
      verified_at: Date | null;
      verified_by: string | null;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, checklist_id, step, item_key, title, description,
              is_verified, verified_at, verified_by, notes, created_at, updated_at
         FROM onboarding_items
        WHERE checklist_id = $1
        ORDER BY created_at ASC`,
      [checklist.id],
    );

    const items: OnboardingItem[] = itemsRes.rows.map((i) => ({
      id: i.id,
      checklistId: i.checklist_id,
      step: i.step,
      itemKey: i.item_key,
      title: i.title,
      description: i.description,
      isVerified: i.is_verified,
      verifiedAt: i.verified_at,
      verifiedBy: i.verified_by,
      notes: i.notes,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));

    return {
      id: checklist.id,
      employeeId: checklist.employee_id,
      employeeCode: checklist.employee_code,
      firstName: checklist.first_name,
      lastName: checklist.last_name,
      email: checklist.email,
      departmentId: checklist.department_id,
      departmentName: checklist.department_name ?? '',
      designationId: checklist.designation_id,
      designationTitle: checklist.designation_title ?? '',
      managerId: checklist.manager_id,
      joiningDate: checklist.joining_date,
      employeeStatus: checklist.employee_status,
      userActive: checklist.user_active,
      status: checklist.status,
      currentStep: checklist.current_step,
      completedAt: checklist.completed_at,
      createdAt: checklist.created_at,
      updatedAt: checklist.updated_at,
      totalItems: items.length,
      verifiedItems: items.filter((i) => i.isVerified).length,
      items,
    };
  }

  async getChecklistDetailByUserId(
    tx: OnboardingTx | null,
    userId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    const client = this.getClient(tx);
    const empRes = await client.query<{ employee_id: string }>(
      `SELECT employee_id FROM users WHERE id = $1`,
      [userId],
    );
    const empId = empRes.rows[0]?.employee_id;
    if (!empId) return null;
    return this.getChecklistDetail(tx, empId);
  }

  async ensureChecklist(tx: OnboardingTx, employeeId: string): Promise<OnboardingChecklistDetail> {
    const existing = await this.getChecklistDetail(tx, employeeId);
    if (existing) return existing;

    const checklistInsert = await tx.query<{ id: string }>(
      `INSERT INTO onboarding_checklists (employee_id, status, current_step)
       VALUES ($1, 'in_progress', 'hr')
       ON CONFLICT (employee_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [employeeId],
    );
    const checklistId = checklistInsert.rows[0]!.id;

    for (const item of DEFAULT_ONBOARDING_ITEMS) {
      await tx.query(
        `INSERT INTO onboarding_items
           (checklist_id, step, item_key, title, description, is_verified, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (checklist_id, item_key) DO NOTHING`,
        [
          checklistId,
          item.step,
          item.itemKey,
          item.title,
          item.description,
          Boolean(item.autoVerified),
          item.autoVerified ? new Date() : null,
        ],
      );
    }

    const detail = await this.getChecklistDetail(tx, employeeId);
    return detail!;
  }

  async findUserByEmployeeId(
    tx: OnboardingTx,
    employeeId: string,
  ): Promise<{ id: string; email: string } | null> {
    const client = this.getClient(tx);
    const res = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE employee_id = $1`,
      [employeeId],
    );
    return res.rows[0] ?? null;
  }

  async lockChecklist(
    tx: OnboardingTx,
    employeeId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    await tx.query(`SELECT id FROM employees WHERE id = $1 FOR UPDATE`, [employeeId]);
    await this.ensureChecklist(tx, employeeId);
    await tx.query(`SELECT id FROM onboarding_checklists WHERE employee_id = $1 FOR UPDATE`, [
      employeeId,
    ]);
    return this.getChecklistDetail(tx, employeeId);
  }

  async verifyItem(
    tx: OnboardingTx,
    checklistId: string,
    itemKey: string,
    verifiedBy: string,
    notes?: string,
  ): Promise<OnboardingItem> {
    const res = await tx.query<{
      id: string;
      checklist_id: string;
      step: 'hr' | 'system' | 'it_admin' | 'employee';
      item_key: string;
      title: string;
      description: string | null;
      is_verified: boolean;
      verified_at: Date | null;
      verified_by: string | null;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE onboarding_items
          SET is_verified = true,
              verified_at = NOW(),
              verified_by = $3,
              notes = COALESCE($4, notes),
              updated_at = NOW()
        WHERE checklist_id = $1 AND item_key = $2
        RETURNING *`,
      [checklistId, itemKey, verifiedBy, notes ?? null],
    );

    const row = res.rows[0];
    if (!row) throw new Error(`Failed to verify onboarding item: ${itemKey}`);
    return {
      id: row.id,
      checklistId: row.checklist_id,
      step: row.step,
      itemKey: row.item_key,
      title: row.title,
      description: row.description,
      isVerified: row.is_verified,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async unverifyItem(
    tx: OnboardingTx,
    checklistId: string,
    itemKey: string,
  ): Promise<OnboardingItem> {
    const res = await tx.query<{
      id: string;
      checklist_id: string;
      step: 'hr' | 'system' | 'it_admin' | 'employee';
      item_key: string;
      title: string;
      description: string | null;
      is_verified: boolean;
      verified_at: Date | null;
      verified_by: string | null;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE onboarding_items
          SET is_verified = false,
              verified_at = null,
              verified_by = null,
              updated_at = NOW()
        WHERE checklist_id = $1 AND item_key = $2
        RETURNING *`,
      [checklistId, itemKey],
    );

    const row = res.rows[0];
    if (!row) throw new Error(`Failed to unverify onboarding item: ${itemKey}`);
    return {
      id: row.id,
      checklistId: row.checklist_id,
      step: row.step,
      itemKey: row.item_key,
      title: row.title,
      description: row.description,
      isVerified: row.is_verified,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateChecklistState(
    tx: OnboardingTx,
    checklistId: string,
    step: OnboardingStep,
    status: OnboardingStatus,
    completedAt?: Date | null,
  ): Promise<void> {
    await tx.query(
      `UPDATE onboarding_checklists
          SET current_step = $2,
              status = $3,
              completed_at = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [checklistId, step, status, completedAt ?? null],
    );
  }

  async activateAccount(tx: OnboardingTx, employeeId: string): Promise<void> {
    await tx.query(`UPDATE employees SET status = 'active', updated_at = NOW() WHERE id = $1`, [
      employeeId,
    ]);
    await tx.query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE employee_id = $1`, [
      employeeId,
    ]);
  }

  async reopenAccount(tx: OnboardingTx, employeeId: string): Promise<{ userId: string }> {
    await tx.query(`UPDATE employees SET status = 'pending', updated_at = NOW() WHERE id = $1`, [
      employeeId,
    ]);
    const userRes = await tx.query<{ id: string }>(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE employee_id = $1 RETURNING id`,
      [employeeId],
    );
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      throw new Error(`User not found for employee ${employeeId}`);
    }
    return { userId };
  }

  async createSetPasswordToken(
    tx: OnboardingTx,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    // Invalidate existing unused tokens
    await tx.query(
      `UPDATE set_password_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await tx.query(
      `INSERT INTO set_password_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findValidSetPasswordToken(
    tx: OnboardingTx,
    tokenHash: string,
  ): Promise<{ id: string; userId: string; employeeId: string; email: string } | null> {
    const res = await tx.query<{
      id: string;
      user_id: string;
      employee_id: string;
      email: string;
    }>(
      `SELECT t.id, t.user_id, u.employee_id, u.email
         FROM set_password_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1
          AND t.used_at IS NULL
          AND t.expires_at > NOW()
        FOR UPDATE OF t`,
      [tokenHash],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      employeeId: row.employee_id,
      email: row.email,
    };
  }

  async consumeSetPasswordToken(
    tx: OnboardingTx,
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await tx.query(`UPDATE set_password_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
    await tx.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      userId,
      passwordHash,
    ]);
  }
}
