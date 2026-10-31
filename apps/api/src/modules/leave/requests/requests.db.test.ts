import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { SqlAuditStore } from '../../../platform/audit/sql-audit-store';
import { PgApprovalsRepository } from '../../approvals/approvals.repository';
import { ApprovalCaller, ApprovalsService } from '../../approvals/approvals.service';
import { toScopeFilter } from '../../rbac';
import { PgHolidaysRepository } from '../holidays/holidays.repository';
import { HolidaysService } from '../holidays/holidays.service';
import { PgLeavePoliciesRepository } from '../policies/policies.repository';
import { LeavePoliciesService } from '../policies/policies.service';
import type { LeaveTx } from '../policies/policies.types';
import { PgLeaveRequestsRepository } from './requests.repository';
import { LeaveCaller, LeaveRequestsService } from './requests.service';
import type { LeaveRequestStatus } from './requests.types';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const UNPAID = '71000000-0000-4000-8000-000000000004';
const YEAR = 2090;

/**
 * Real PostgreSQL. Locks, the exclusion constraint and rollbacks cannot be shown inside one
 * rolled-back transaction, so this file commits its own fixtures (unique codes per run, dates in
 * 2090) and deletes them at the end. The clock is Sunday 2090-01-01 in Asia/Kolkata; 2 January
 * is a Monday, and 10 January (a Wednesday) is a holiday.
 */
describe('leave requests against PostgreSQL', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', manager: '', requester: '', hr: '', user: '' };
  let failAfterDeduct = false;
  let failOnCancel = false;

  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent, auditStore: new SqlAuditStore(pool) });
  const settings = {
    getBasic: async () =>
      ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }) as never,
  };
  const clock = () => new Date('2090-01-01T10:00:00Z');

  // The failure-injection hook: the status update after the deduction throws.
  class FlakyRepository extends PgLeaveRequestsRepository {
    override async setStatus(tx: LeaveTx, id: string, status: LeaveRequestStatus) {
      if (failAfterDeduct && status === 'approved') throw new Error('status write failed');
      if (failOnCancel && status === 'cancelled') throw new Error('cancel write failed');
      return super.setStatus(tx, id, status);
    }
  }
  const approvals = new ApprovalsService(new PgApprovalsRepository(getPool), platform);
  const service = new LeaveRequestsService(
    new FlakyRepository(getPool),
    approvals,
    platform,
    settings,
    new HolidaysService(new PgHolidaysRepository(getPool), platform, settings, clock),
    new LeavePoliciesService(new PgLeavePoliciesRepository(getPool), platform),
    clock,
  );
  approvals.registerHandler(service);
  // The same service on Wednesday 4 January 2090, after 2 to 4 January have started.
  const later = new LeaveRequestsService(
    new FlakyRepository(getPool),
    approvals,
    platform,
    settings,
    new HolidaysService(new PgHolidaysRepository(getPool), platform, settings, clock),
    new LeavePoliciesService(new PgLeavePoliciesRepository(getPool), platform),
    () => new Date('2090-01-04T10:00:00Z'),
  );
  const noRights = (): { kind: 'none' } => ({ kind: 'none' });
  const hrScope = { kind: 'all' } as const;

  const requesterCaller = (): LeaveCaller => ({ actorId: randomUUID(), employeeId: ids.requester });
  const managerCaller = (): ApprovalCaller => ({
    actorId: randomUUID(),
    employeeId: ids.manager,
    roles: [ROLES.TEAM_LEAD],
  });
  const teamFilter = () => toScopeFilter('team', { employeeId: ids.manager });
  const approve = (approvalId: string) =>
    approvals.decide(approvalId, 'approved', undefined, managerCaller(), teamFilter());
  const reject = (approvalId: string) =>
    approvals.decide(approvalId, 'rejected', 'No', managerCaller(), teamFilter());
  const apply = (startDate: string, endDate: string, extra: object = {}) =>
    service.request(
      { leaveTypeId: ANNUAL, startDate, endDate, halfDay: false, ...extra },
      requesterCaller(),
    );

  const balance = async () =>
    (
      await pool.query<{ used: string; allotted: string }>(
        `SELECT used, allotted FROM leave_balances
          WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
        [ids.requester, ANNUAL, YEAR],
      )
    ).rows[0];
  const statusOf = async (id: string) =>
    (await pool.query<{ status: string }>(`SELECT status FROM leave_requests WHERE id = $1`, [id]))
      .rows[0]?.status;
  const approvalStatus = async (id: string) =>
    (await pool.query<{ status: string }>(`SELECT status FROM approvals WHERE id = $1`, [id]))
      .rows[0]?.status;
  const refused = async (sql: string, values: unknown[]) =>
    pool.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e.code ?? 'error',
    );

  beforeAll(async () => {
    const dept = await pool.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`LeaveReq ${run}`, `LR-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';
    const desig = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Staff', $2) RETURNING id`,
      [ids.dept, `LR-${run}`],
    );
    ids.desig = desig.rows[0]?.id ?? '';
    const add = async (name: string, managerId?: string) =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
           VALUES ($1, $2, 'Leave', $3, $4, $5, $6) RETURNING id`,
          [
            `LR-${run}-${name}`,
            name,
            `${name}-${run}@leavereq.test`,
            ids.dept,
            ids.desig,
            managerId ?? null,
          ],
        )
      ).rows[0]?.id ?? '';
    ids.manager = await add('manager');
    ids.hr = await add('hr');
    ids.requester = await add('requester', ids.manager);
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash) VALUES ($1, $2, 'x') RETURNING id`,
      [ids.requester, `requester-${run}@leavereq.test`],
    );
    ids.user = user.rows[0]?.id ?? '';
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
      [ids.user, ROLES.STAFF],
    );
    await pool.query(`DELETE FROM holidays WHERE holiday_date = '2090-01-10'`);
    await pool.query(
      `INSERT INTO holidays (holiday_date, name) VALUES ('2090-01-10', 'Test holiday')`,
    );
  });

  beforeEach(async () => {
    failAfterDeduct = false;
    failOnCancel = false;
    await pool.query(`DELETE FROM approvals WHERE requester_employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM leave_requests WHERE employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM leave_balances WHERE employee_id = $1`, [ids.requester]);
    await pool.query(
      `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted) VALUES ($1, $2, $3, 6)`,
      [ids.requester, ANNUAL, YEAR],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM approvals WHERE requester_employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM leave_requests WHERE employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM leave_balances WHERE employee_id = $1`, [ids.requester]);
    await pool.query(`DELETE FROM holidays WHERE holiday_date = '2090-01-10'`);
    await pool.query(`DELETE FROM users WHERE id = $1`, [ids.user]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [
      [ids.requester, ids.manager, ids.hr],
    ]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('applies: pending with its approval, days counted from the real holiday table', async () => {
    // 9 to 13 January 2090 is Monday to Friday, with the holiday on Wednesday the 10th.
    const created = await apply('2090-01-09', '2090-01-13');
    expect(created).toMatchObject({ status: 'pending', days: 4, startDate: '2090-01-09' });
    expect(created.approvalId).toEqual(expect.any(String));
    expect(await statusOf(created.id)).toBe('pending');
    expect(Number((await balance())?.used)).toBe(0); // nothing is deducted before approval
  });

  it('approval deducts in the same transaction, once, with a before/after audit entry', async () => {
    const created = await apply('2090-01-02', '2090-01-04'); // 3 days
    await approve(created.approvalId as string);
    expect(Number((await balance())?.used)).toBe(3);
    expect(await statusOf(created.id)).toBe('approved');
    await approve(created.approvalId as string); // repeating the decision that stands
    expect(Number((await balance())?.used)).toBe(3);
    const audit = await pool.query<{ changes: Record<string, { from: number; to: number }> }>(
      `SELECT changes FROM audit_logs WHERE entity_id = $1 AND action = 'leave.approve'`,
      [created.id],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]?.changes).toEqual({ balanceUsed: { from: 0, to: 3 } });
  });

  it('two simultaneous approvals of the same request deduct once', async () => {
    const created = await apply('2090-01-02', '2090-01-04');
    const results = await Promise.allSettled([
      approve(created.approvalId as string),
      approve(created.approvalId as string),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(Number((await balance())?.used)).toBe(3);
  });

  it('a rejection deducts nothing and frees the dates', async () => {
    const created = await apply('2090-01-02', '2090-01-04');
    await reject(created.approvalId as string);
    expect(await statusOf(created.id)).toBe('rejected');
    expect(Number((await balance())?.used)).toBe(0);
    await expect(apply('2090-01-02', '2090-01-04')).resolves.toMatchObject({ status: 'pending' });
  });

  it('serialises two applications at once, so together they cannot exceed the balance', async () => {
    // 6 days available; 4 + 4 do not fit.
    const results = await Promise.allSettled([
      apply('2090-01-02', '2090-01-05'),
      apply('2090-01-16', '2090-01-19'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ statusCode: 422 });
    const live = await pool.query(
      `SELECT 1 FROM leave_requests WHERE employee_id = $1 AND status = 'pending'`,
      [ids.requester],
    );
    expect(live.rowCount).toBe(1);
  });

  it('refuses overlapping dates, including two requests for the same dates at once', async () => {
    const results = await Promise.allSettled([
      apply('2090-01-02', '2090-01-03'),
      apply('2090-01-03', '2090-01-04'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ statusCode: 409 });
    // The approval of the refused request was not left behind.
    const orphans = await pool.query(
      `SELECT 1 FROM approvals a WHERE a.subject_type = 'leave_request'
        AND a.requester_employee_id = $1
        AND NOT EXISTS (SELECT 1 FROM leave_requests r WHERE r.id = a.subject_id)`,
      [ids.requester],
    );
    expect(orphans.rowCount).toBe(0);
  });

  it('the database itself refuses overlaps of live requests, and ignores cancelled ones', async () => {
    const insert = (start: string, end: string, status = 'pending') =>
      refused(
        `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [ids.requester, ANNUAL, start, end, status],
      );
    expect(await insert('2090-01-02', '2090-01-02', 'approved')).toBeNull();
    expect(await insert('2090-01-02', '2090-01-02')).toBe('23P01');
    expect(await insert('2090-01-02', '2090-01-02', 'cancelled')).toBeNull();
    expect(await insert('2090-01-02', '2090-01-02', 'rejected')).toBeNull();
  });

  it('keeps the approval pending and the balance untouched when it no longer covers the request', async () => {
    const created = await apply('2090-01-02', '2090-01-05'); // 4 days of 6
    await pool.query(
      `UPDATE leave_balances SET used = 3 WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [ids.requester, ANNUAL, YEAR],
    ); // other leave was approved first: 3 left
    await expect(approve(created.approvalId as string)).rejects.toMatchObject({ statusCode: 409 });
    expect(Number((await balance())?.used)).toBe(3);
    expect(await statusOf(created.id)).toBe('pending');
    expect(await approvalStatus(created.approvalId as string)).toBe('pending');
    await expect(reject(created.approvalId as string)).resolves.toMatchObject({
      status: 'rejected',
    });
  });

  it('never over-spends when two approvals race for a balance that covers only one', async () => {
    const first = await apply('2090-01-02', '2090-01-04'); // 3
    const second = await apply('2090-01-09', '2090-01-11'); // 2 (the 10th is a holiday)
    await pool.query(
      `UPDATE leave_balances SET allotted = 4 WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [ids.requester, ANNUAL, YEAR],
    ); // 3 + 2 = 5 > 4
    const results = await Promise.allSettled([
      approve(first.approvalId as string),
      approve(second.approvalId as string),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const used = Number((await balance())?.used);
    expect(used === 3 || used === 2).toBe(true);
    expect(used).toBeLessThanOrEqual(4);
  });

  it('a failure after the deduction undoes the whole decision', async () => {
    const created = await apply('2090-01-02', '2090-01-04');
    failAfterDeduct = true;
    await expect(approve(created.approvalId as string)).rejects.toThrow('status write failed');
    expect(Number((await balance())?.used)).toBe(0);
    expect(await statusOf(created.id)).toBe('pending');
    expect(await approvalStatus(created.approvalId as string)).toBe('pending');
    const audit = await pool.query(
      `SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'leave.approve'`,
      [created.id],
    );
    expect(audit.rowCount).toBe(0);
    failAfterDeduct = false;
    await approve(created.approvalId as string);
    expect(Number((await balance())?.used)).toBe(3);
  });

  it('a type without a balance needs no balance row and deducts nothing', async () => {
    const created = await service.request(
      { leaveTypeId: UNPAID, startDate: '2090-01-02', endDate: '2090-01-06', halfDay: false },
      requesterCaller(),
    );
    expect(created.days).toBe(5);
    await approve(created.approvalId as string);
    expect(await statusOf(created.id)).toBe('approved');
    expect(Number((await balance())?.used)).toBe(0);
  });

  it('refuses a half-day request the database finds inconsistent, and a balance that is not there', async () => {
    const insert = (start: string, end: string, days: number, half: boolean) =>
      refused(
        `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, half_day)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ids.requester, ANNUAL, start, end, days, half],
      );
    expect(await insert('2090-01-02', '2090-01-03', 0.5, true)).toBe('23514'); // half day over two dates
    expect(await insert('2090-01-02', '2090-01-02', 1, true)).toBe('23514'); // half day of a whole day
    expect(await insert('2090-01-02', '2090-01-02', 0.25, false)).toBe('23514');
    expect(await insert('2090-01-02', '2090-01-02', 0, false)).toBe('23514');
    expect(await insert('2090-01-03', '2090-01-02', 1, false)).toBe('23514');
    expect(await insert('2090-12-31', '2091-01-02', 2, false)).toBe('23514'); // two years
    expect(await insert('2090-01-02', '2090-01-02', 0.5, true)).toBeNull();
    await expect(
      service.request(
        { leaveTypeId: ANNUAL, startDate: '2091-01-05', endDate: '2091-01-05', halfDay: false },
        requesterCaller(),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('lists in scope and filters by a date range', async () => {
    const a = await apply('2090-01-02', '2090-01-03');
    await apply('2090-01-16', '2090-01-17');
    const repo = new PgLeaveRequestsRepository(getPool);
    const base = { offset: 0, limit: 20 };
    const own = await repo.findMany({
      ...base,
      filter: { kind: 'own', employeeId: ids.requester },
    });
    expect(own.total).toBe(2);
    expect(own.items[0]?.startDate).toBe('2090-01-16'); // latest first
    const team = await repo.findMany({ ...base, filter: { kind: 'team', managerId: ids.manager } });
    expect(team.total).toBe(2);
    const stranger = await repo.findMany({ ...base, filter: { kind: 'team', managerId: ids.hr } });
    expect(stranger.total).toBe(0);
    const ranged = await repo.findMany({
      ...base,
      filter: { kind: 'all' },
      employeeId: ids.requester,
      from: '2090-01-03',
      to: '2090-01-05',
    });
    expect(ranged.items.map((r) => r.id)).toEqual([a.id]);
    expect(await repo.find(a.id, { kind: 'team', managerId: ids.hr })).toBeNull();
    expect((await repo.find(a.id, { kind: 'team', managerId: ids.manager }))?.approvalId).toBe(
      a.approvalId,
    );
  });

  describe('cancelling', () => {
    const cancel = (id: string, scope: Parameters<typeof service.cancel>[2] = noRights()) =>
      service.cancel(id, requesterCaller(), scope);

    it('a pending request is withdrawn with its approval, and nothing is deducted', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await expect(cancel(created.id)).resolves.toMatchObject({ status: 'cancelled' });
      expect(await statusOf(created.id)).toBe('cancelled');
      expect(await approvalStatus(created.approvalId as string)).toBe('cancelled');
      expect(Number((await balance())?.used)).toBe(0);
      await expect(apply('2090-01-02', '2090-01-04')).resolves.toMatchObject({ status: 'pending' });
    });

    it('approved leave gives exactly its days back, once', async () => {
      const created = await apply('2090-01-02', '2090-01-04'); // 3 days
      await approve(created.approvalId as string);
      expect(Number((await balance())?.used)).toBe(3);
      await cancel(created.id);
      expect(Number((await balance())?.used)).toBe(0);
      expect(await statusOf(created.id)).toBe('cancelled');
      await expect(cancel(created.id)).rejects.toMatchObject({ statusCode: 409 });
      expect(Number((await balance())?.used)).toBe(0);
      const audit = await pool.query<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_logs WHERE entity_id = $1 AND action = 'leave.cancel'`,
        [created.id],
      );
      expect(audit.rows[0]?.changes).toEqual({
        status: { from: 'approved', to: 'cancelled' },
        balanceUsed: { from: 3, to: 0 },
      });
    });

    it('two cancellations at once restore the days once and never push the balance below zero', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await approve(created.approvalId as string);
      const results = await Promise.allSettled([cancel(created.id), cancel(created.id)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason,
      ).toMatchObject({
        statusCode: 409,
      });
      expect(Number((await balance())?.used)).toBe(0);
    });

    it('a cancel and an approval at the same moment end in one consistent state without deadlocking', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await Promise.allSettled([approve(created.approvalId as string), cancel(created.id)]);
      const status = await statusOf(created.id);
      expect(['approved', 'cancelled']).toContain(status);
      // Whatever won, the balance matches: approved holds the days, cancelled holds none.
      expect(Number((await balance())?.used)).toBe(status === 'approved' ? 3 : 0);
      // And an approved one can still be cancelled afterwards, giving the days back.
      if (status === 'approved') {
        await cancel(created.id);
        expect(Number((await balance())?.used)).toBe(0);
      }
    });

    it('a failure while cancelling undoes the restore', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await approve(created.approvalId as string);
      failOnCancel = true;
      await expect(cancel(created.id)).rejects.toThrow('cancel write failed');
      expect(Number((await balance())?.used)).toBe(3);
      expect(await statusOf(created.id)).toBe('approved');
      failOnCancel = false;
      await cancel(created.id);
      expect(Number((await balance())?.used)).toBe(0);
    });

    it('after the start date only HR can cancel, and the days still come back', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await approve(created.approvalId as string);
      // On 4 January the leave has started: the owner is refused, HR is not.
      await expect(later.cancel(created.id, requesterCaller(), noRights())).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(Number((await balance())?.used)).toBe(3);
      const hr: LeaveCaller = { actorId: randomUUID(), employeeId: ids.hr };
      await expect(later.cancel(created.id, hr, hrScope)).resolves.toMatchObject({
        status: 'cancelled',
      });
      expect(Number((await balance())?.used)).toBe(0);
    });

    it('someone without the right gets a 404 and nothing changes', async () => {
      const created = await apply('2090-01-02', '2090-01-04');
      await approve(created.approvalId as string);
      const stranger: LeaveCaller = { actorId: randomUUID(), employeeId: ids.hr };
      await expect(service.cancel(created.id, stranger, noRights())).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(Number((await balance())?.used)).toBe(3);
    });

    it('the repository will not give back more days than were used', async () => {
      const repo = new PgLeaveRequestsRepository(getPool);
      await repo.transaction(async (tx) => {
        expect(await repo.restore(tx, ids.requester, ANNUAL, YEAR, 1)).toBeNull();
        expect(await repo.restore(tx, ids.requester, UNPAID, YEAR, 1)).toBeNull();
      });
    });
  });

  describe('the calendar', () => {
    it('lists pending and approved leave in scope, without the reason, and leaves out the rest', async () => {
      const kept = await apply('2090-01-02', '2090-01-03', { reason: 'Private' });
      const dropped = await apply('2090-01-09', '2090-01-09');
      await service.cancel(dropped.id, requesterCaller(), noRights());
      await approve(kept.approvalId as string);
      const repo = new PgLeaveRequestsRepository(getPool);
      const forManager = await repo.findCalendar({
        filter: { kind: 'team', managerId: ids.manager },
        from: '2090-01-01',
        to: '2090-01-31',
      });
      expect(forManager).toHaveLength(1);
      expect(forManager[0]).toMatchObject({ requestId: kept.id, status: 'approved', days: 2 });
      expect(JSON.stringify(forManager)).not.toContain('Private');
      expect(
        await repo.findCalendar({
          filter: { kind: 'team', managerId: ids.hr },
          from: '2090-01-01',
          to: '2090-01-31',
        }),
      ).toEqual([]);
      expect(
        await repo.findCalendar({ filter: { kind: 'all' }, from: '2090-01-04', to: '2090-01-08' }),
      ).toEqual([]);
    });
  });
});
