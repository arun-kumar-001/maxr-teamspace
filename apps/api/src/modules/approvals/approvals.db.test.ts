import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { SqlAuditStore } from '../../platform/audit/sql-audit-store';
import { toScopeFilter } from '../rbac';
import { PgApprovalsRepository } from './approvals.repository';
import { ApprovalCaller, ApprovalsService } from './approvals.service';
import { ApprovalHandler, ApprovalOutcome } from './approvals.types';

/**
 * Real PostgreSQL. Row locking and transaction rollback cannot be shown inside one rolled-back
 * transaction, so this file commits its own fixtures (unique codes per run) and deletes them at the end.
 */
describe('approvals against PostgreSQL', () => {
  const pool = getPool();
  const repo = new PgApprovalsRepository(getPool);
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', requester: '', manager: '', hr: '', user: '' };
  const applied: Array<{ subjectId: string; outcome: ApprovalOutcome }> = [];
  let delayMs = 0;
  let failAfterWrite = false;

  const silent = createLogger({ level: 'silent', write: () => undefined });
  // The real audit table: the audit entry must share the decision's transaction.
  const { platform } = createTestPlatform({ logger: silent, auditStore: new SqlAuditStore(pool) });
  const service = new ApprovalsService(repo, platform);
  const handler: ApprovalHandler = {
    subjectType: 'leave_request',
    async apply(tx, approval, outcome) {
      // The module's own write, in the decision transaction.
      await tx.query(`UPDATE employees SET phone = $2 WHERE id = $1`, [
        approval.requesterEmployeeId,
        `${outcome}-${approval.subjectId.slice(0, 8)}`,
      ]);
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (failAfterWrite) throw new Error('module write failed');
      applied.push({ subjectId: approval.subjectId, outcome });
    },
  };
  service.registerHandler(handler);

  const asCaller = (employeeId: string, roles: ApprovalCaller['roles']): ApprovalCaller => ({
    actorId: randomUUID(),
    employeeId,
    roles,
  });
  const manager = () => asCaller(ids.manager, [ROLES.TEAM_LEAD]);
  const hr = () => asCaller(ids.hr, [ROLES.HR_MANAGER]);
  const teamFilter = () => toScopeFilter('team', { employeeId: ids.manager });

  const open = (stages: Array<'manager' | 'hr'>, subjectId: string = randomUUID()) =>
    repo.transaction((tx) =>
      service.submit(tx, {
        subjectType: 'leave_request',
        subjectId,
        requesterEmployeeId: ids.requester,
        stages,
      }),
    );
  const phone = async () =>
    (
      await pool.query<{ phone: string | null }>(`SELECT phone FROM employees WHERE id = $1`, [
        ids.requester,
      ])
    ).rows[0]?.phone;

  beforeAll(async () => {
    const dept = await pool.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Approvals ${run}`, `AP-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';
    const desig = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Approver', $2) RETURNING id`,
      [ids.dept, `AP-${run}`],
    );
    ids.desig = desig.rows[0]?.id ?? '';
    const add = async (name: string, managerId?: string) => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'Approvals', $3, $4, $5, $6) RETURNING id`,
        [
          `AP-${run}-${name}`,
          name,
          `${name}-${run}@approvals.test`,
          ids.dept,
          ids.desig,
          managerId ?? null,
        ],
      );
      return res.rows[0]?.id ?? '';
    };
    ids.manager = await add('manager');
    ids.hr = await add('hr');
    ids.requester = await add('requester', ids.manager);
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash) VALUES ($1, $2, 'x') RETURNING id`,
      [ids.requester, `requester-${run}@approvals.test`],
    );
    ids.user = user.rows[0]?.id ?? '';
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
      [ids.user, ROLES.STAFF],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM approvals WHERE requester_employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [ids.user]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [
      [ids.requester, ids.manager, ids.hr],
    ]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('routes the requester from the real employee and role rows', async () => {
    expect(await repo.transaction((tx) => service.route(tx, ids.requester))).toEqual(['manager']);
    expect(
      await repo.transaction((tx) => service.route(tx, ids.requester, { twoStep: true })),
    ).toEqual(['manager', 'hr']);
    expect(
      await repo.transaction((tx) => service.route(tx, ids.manager, { twoStep: true })),
    ).toEqual(['hr']);
  });

  it('keeps the approval out of the database when the module rolls its own transaction back', async () => {
    const subjectId = randomUUID();
    await expect(
      repo.transaction(async (tx) => {
        await service.submit(tx, {
          subjectType: 'leave_request',
          subjectId,
          requesterEmployeeId: ids.requester,
          stages: ['manager'],
        });
        throw new Error('storing the leave request failed');
      }),
    ).rejects.toThrow();
    const found = await pool.query(`SELECT 1 FROM approvals WHERE subject_id = $1`, [subjectId]);
    expect(found.rowCount).toBe(0);
  });

  it('allows one approval per subject', async () => {
    const a = await open(['manager']);
    await expect(open(['manager'], a.subjectId)).rejects.toMatchObject({ code: '23505' });
  });

  it('approving commits the decision and the module write together', async () => {
    const a = await open(['manager']);
    const done = await service.decide(a.id, 'approved', 'fine', manager(), teamFilter());
    expect(done).toMatchObject({ status: 'approved', requesterName: 'requester Approvals' });
    expect(done.decisions).toMatchObject([
      { stage: 0, decidedByEmployeeId: ids.manager, comment: 'fine' },
    ]);
    expect(await phone()).toBe(`approved-${a.subjectId.slice(0, 8)}`);
  });

  it('a module failure after its write undoes both the write and the decision', async () => {
    const a = await open(['manager']);
    const before = await phone();
    failAfterWrite = true;
    await expect(
      service.decide(a.id, 'approved', undefined, manager(), teamFilter()),
    ).rejects.toThrow('module write failed');
    failAfterWrite = false;
    expect(await phone()).toBe(before);
    const stored = await service.get(a.id, { kind: 'all' });
    expect(stored).toMatchObject({ status: 'pending', currentStage: 0, decisions: [] });
    const decisions = await pool.query(`SELECT 1 FROM approval_decisions WHERE approval_id = $1`, [
      a.id,
    ]);
    expect(decisions.rowCount).toBe(0);
  });

  it('writes the audit entry in the decision transaction: committed with it, absent when it rolls back', async () => {
    const audited = (id: string) =>
      pool.query(
        `SELECT outcome FROM audit_logs WHERE entity_id = $1 AND action = 'approvals.approve' ORDER BY outcome`,
        [id],
      );

    const good = await open(['manager']);
    await service.decide(good.id, 'approved', undefined, manager(), teamFilter());
    expect((await audited(good.id)).rows).toEqual([{ outcome: 'success' }]);

    const bad = await open(['manager']);
    failAfterWrite = true;
    await expect(
      service.decide(bad.id, 'approved', undefined, manager(), teamFilter()),
    ).rejects.toThrow();
    failAfterWrite = false;
    // The success entry was written, then the module failed and the transaction rolled back: only the failure entry stays.
    expect((await audited(bad.id)).rows).toEqual([{ outcome: 'failure' }]);
  });

  it('two approvers deciding at the same moment: the module runs once, both get 200', async () => {
    const a = await open(['manager']);
    const before = applied.length;
    delayMs = 150;
    const results = await Promise.all([
      service.decide(a.id, 'approved', undefined, manager(), teamFilter()),
      service.decide(a.id, 'approved', undefined, manager(), teamFilter()),
    ]);
    delayMs = 0;
    expect(results.map((r) => r.status)).toEqual(['approved', 'approved']);
    expect(applied.length - before).toBe(1);
    const decisions = await pool.query(`SELECT 1 FROM approval_decisions WHERE approval_id = $1`, [
      a.id,
    ]);
    expect(decisions.rowCount).toBe(1);
  });

  it('an approve and a reject at the same moment: exactly one wins, the other is a 409', async () => {
    const a = await open(['manager']);
    delayMs = 150;
    const settled = await Promise.allSettled([
      service.decide(a.id, 'approved', undefined, manager(), teamFilter()),
      service.decide(a.id, 'rejected', 'no', manager(), teamFilter()),
    ]);
    delayMs = 0;
    const winners = settled.filter((s) => s.status === 'fulfilled');
    const losers = settled.filter((s) => s.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    const stored = await service.get(a.id, { kind: 'all' });
    expect(stored.decisions).toHaveLength(1);
    expect(stored.status).toBe(stored.decisions[0]?.outcome);
  });

  it('a two-step route is decided in order and by different people', async () => {
    const a = await open(['manager', 'hr']);
    await expect(
      service.decide(a.id, 'approved', undefined, hr(), { kind: 'all' }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    await service.decide(a.id, 'approved', undefined, manager(), teamFilter());
    const end = await service.decide(a.id, 'approved', undefined, hr(), { kind: 'all' });
    expect(end).toMatchObject({ status: 'approved', currentStage: 1 });
    expect(end.decisions.map((d) => d.stage)).toEqual([0, 1]);
  });

  it('the inbox applies the scope and the awaiting filter in SQL, oldest first', async () => {
    const first = await open(['manager']);
    const second = await open(['hr']);
    const mine = await service.list(
      { page: 1, pageSize: 50, status: 'pending', awaitingMyDecision: true },
      manager(),
      teamFilter(),
    );
    expect(mine.data.map((a) => a.id)).toContain(first.id);
    expect(mine.data.map((a) => a.id)).not.toContain(second.id);

    const forHr = await service.list(
      { page: 1, pageSize: 50, status: 'pending', awaitingMyDecision: true },
      hr(),
      { kind: 'all' },
    );
    expect(forHr.data.map((a) => a.id)).toContain(second.id);
    expect(forHr.data.map((a) => a.id)).not.toContain(first.id);

    const stranger = await service.list(
      { page: 1, pageSize: 50 },
      asCaller(randomUUID(), [ROLES.TEAM_LEAD]),
      {
        kind: 'team',
        managerId: randomUUID(),
      },
    );
    expect(stranger.meta.total).toBe(0);
    const times = (
      await service.list({ page: 1, pageSize: 100, status: 'pending' }, hr(), { kind: 'all' })
    ).data.map((a) => a.createdAt);
    expect(times).toEqual([...times].sort());
  });

  it('cancel withdraws a pending approval and refuses a decided one', async () => {
    const a = await open(['manager']);
    const cancelled = await repo.transaction((tx) =>
      service.cancel(tx, 'leave_request', a.subjectId),
    );
    expect(cancelled?.status).toBe('cancelled');
    await expect(
      service.decide(a.id, 'approved', undefined, manager(), teamFilter()),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it.each([
    [
      'an unknown stage name',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages) VALUES ('t', gen_random_uuid(), $1, ARRAY['boss'])`,
    ],
    [
      'no stages',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages) VALUES ('t', gen_random_uuid(), $1, ARRAY[]::text[])`,
    ],
    [
      'a current stage past the route',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages, current_stage) VALUES ('t', gen_random_uuid(), $1, ARRAY['hr'], 1)`,
    ],
    [
      'a pending approval with a decision time',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages, decided_at) VALUES ('t', gen_random_uuid(), $1, ARRAY['hr'], NOW())`,
    ],
    [
      'an approved approval without a decision time',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages, status) VALUES ('t', gen_random_uuid(), $1, ARRAY['hr'], 'approved')`,
    ],
    [
      'an invalid status',
      `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages, status) VALUES ('t', gen_random_uuid(), $1, ARRAY['hr'], 'done')`,
    ],
  ])('the database refuses %s', async (_name, sql) => {
    await expect(pool.query(sql, [ids.requester])).rejects.toMatchObject({ code: '23514' });
  });

  it('the database refuses a second decision on the same step', async () => {
    const a = await open(['manager']);
    const insert = () =>
      pool.query(
        `INSERT INTO approval_decisions (approval_id, stage, decided_by_employee_id, outcome) VALUES ($1, 0, $2, 'approved')`,
        [a.id, ids.manager],
      );
    await insert();
    await expect(insert()).rejects.toMatchObject({ code: '23505' });
  });
});
