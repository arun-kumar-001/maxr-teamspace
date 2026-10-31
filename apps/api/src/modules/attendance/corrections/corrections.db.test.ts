import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { SqlAuditStore } from '../../../platform/audit/sql-audit-store';
import { PgApprovalsRepository } from '../../approvals/approvals.repository';
import { ApprovalCaller, ApprovalsService } from '../../approvals/approvals.service';
import { toScopeFilter } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';
import type { ShiftResolver } from '../../shifts';
import { PgCorrectionsRepository } from './corrections.repository';
import { AttendanceCorrectionsService, CorrectionCaller } from './corrections.service';

/**
 * Real PostgreSQL. Locks, rollbacks and the unique index cannot be shown inside one rolled-back
 * transaction, so this file commits its own fixtures (unique codes per run) and deletes them at the end.
 * The clock is fixed at 2026-10-31 15:30 in Asia/Kolkata.
 */
describe('attendance corrections against PostgreSQL', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const NOW = new Date('2026-10-31T10:00:00Z');
  const ids = { dept: '', desig: '', manager: '', requester: '', stranger: '', user: '' };
  const shiftStart = '09:00';

  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent, auditStore: new SqlAuditStore(pool) });
  const settings: CompanySettingsReader = {
    getBasic: async () => ({
      companyName: 'Test',
      timezone: 'Asia/Kolkata',
      workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
    }),
  };
  const shifts: ShiftResolver = {
    shiftOn: async () => ({
      id: 's',
      code: 'GENERAL',
      name: 'General',
      startTime: shiftStart,
      endTime: '18:00',
      graceMinutes: 15,
      crossesMidnight: false,
    }),
  };
  const approvalsRepo = new PgApprovalsRepository(getPool);
  const approvals = new ApprovalsService(approvalsRepo, platform);
  const service = new AttendanceCorrectionsService(
    new PgCorrectionsRepository(getPool),
    approvals,
    platform,
    settings,
    shifts,
    () => NOW,
  );
  approvals.registerHandler(service);

  const requesterCaller = (): CorrectionCaller => ({
    actorId: randomUUID(),
    employeeId: ids.requester,
  });
  const managerDecides = (): ApprovalCaller => ({
    actorId: randomUUID(),
    employeeId: ids.manager,
    roles: [ROLES.TEAM_LEAD],
  });
  const teamFilter = () => toScopeFilter('team', { employeeId: ids.manager });
  const approve = (approvalId: string) =>
    approvals.decide(approvalId, 'approved', undefined, managerDecides(), teamFilter());
  const reject = (approvalId: string) =>
    approvals.decide(approvalId, 'rejected', 'No', managerDecides(), teamFilter());

  /** A closed record for the requester on `workDate`, 09:00 to 17:00 IST unless told otherwise. */
  async function record(
    workDate: string,
    options: { employeeId?: string; checkIn?: string; checkOut?: string | null } = {},
  ): Promise<string> {
    const checkIn = options.checkIn ?? `${workDate}T03:30:00Z`;
    const checkOut = options.checkOut === undefined ? `${workDate}T11:30:00Z` : options.checkOut;
    const res = await pool.query<{ id: string }>(
      `INSERT INTO attendance_records
         (employee_id, work_date, check_in_time, check_out_time, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'present') RETURNING id`,
      [options.employeeId ?? ids.requester, workDate, checkIn, checkOut, checkOut ? 480 : null],
    );
    return res.rows[0]?.id ?? '';
  }
  const stored = async (recordId: string) =>
    (
      await pool.query<{
        check_in_time: Date;
        check_out_time: Date | null;
        duration_minutes: number | null;
        status: string;
      }>(
        `SELECT check_in_time, check_out_time, duration_minutes, status FROM attendance_records WHERE id = $1`,
        [recordId],
      )
    ).rows[0];
  const request = (
    recordId: string,
    requestedCheckIn: string,
    requestedCheckOut: string,
    reason = 'Forgot to check out',
  ) =>
    service.request(
      { attendanceRecordId: recordId, requestedCheckIn, requestedCheckOut, reason },
      requesterCaller(),
    );
  const statusOf = async (id: string) =>
    (
      await pool.query<{ status: string }>(
        `SELECT status FROM attendance_corrections WHERE id = $1`,
        [id],
      )
    ).rows[0]?.status;
  const auditActions = async (entityId: string) =>
    (
      await pool.query<{ action: string; changes: Record<string, { from: unknown; to: unknown }> }>(
        `SELECT action, changes FROM audit_logs WHERE entity_id = $1 ORDER BY occurred_at`,
        [entityId],
      )
    ).rows;

  beforeAll(async () => {
    const dept = await pool.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Corrections ${run}`, `CO-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';
    const desig = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Staff', $2) RETURNING id`,
      [ids.dept, `CO-${run}`],
    );
    ids.desig = desig.rows[0]?.id ?? '';
    const add = async (name: string, managerId?: string) => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'Corrections', $3, $4, $5, $6) RETURNING id`,
        [
          `CO-${run}-${name}`,
          name,
          `${name}-${run}@corrections.test`,
          ids.dept,
          ids.desig,
          managerId ?? null,
        ],
      );
      return res.rows[0]?.id ?? '';
    };
    ids.manager = await add('manager');
    ids.requester = await add('requester', ids.manager);
    ids.stranger = await add('stranger');
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash) VALUES ($1, $2, 'x') RETURNING id`,
      [ids.requester, `requester-${run}@corrections.test`],
    );
    ids.user = user.rows[0]?.id ?? '';
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
      [ids.user, ROLES.STAFF],
    );
  });

  afterAll(async () => {
    const employees = [ids.requester, ids.manager, ids.stranger];
    await pool.query(`DELETE FROM attendance_corrections WHERE employee_id = ANY($1::uuid[])`, [
      employees,
    ]);
    await pool.query(`DELETE FROM approvals WHERE requester_employee_id = ANY($1::uuid[])`, [
      employees,
    ]);
    await pool.query(`DELETE FROM attendance_records WHERE employee_id = ANY($1::uuid[])`, [
      employees,
    ]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [ids.user]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [employees]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('files a pending correction with its approval, and approval overwrites the record with a before/after audit entry', async () => {
    const recordId = await record('2026-10-20', { checkOut: null });
    const created = await request(recordId, '2026-10-20T04:00:00Z', '2026-10-20T12:30:00Z');
    expect(created).toMatchObject({
      status: 'pending',
      attendanceRecordId: recordId,
      workDate: '2026-10-20',
      originalCheckOut: null,
    });
    expect(created.approvalId).toEqual(expect.any(String));
    // Nothing changes until it is approved.
    expect((await stored(recordId))?.check_out_time).toBeNull();

    await approve(created.approvalId as string);

    const row = await stored(recordId);
    expect(row?.check_in_time.toISOString()).toBe('2026-10-20T04:00:00.000Z');
    expect(row?.check_out_time?.toISOString()).toBe('2026-10-20T12:30:00.000Z');
    expect(row?.duration_minutes).toBe(510);
    // 09:30 IST is after 09:00 + 15 minutes of grace.
    expect(row?.status).toBe('late');
    expect(await statusOf(created.id)).toBe('approved');

    const applied = (await auditActions(recordId)).find(
      (e) => e.action === 'attendance.correction_apply',
    );
    expect(applied?.changes).toMatchObject({
      checkInTime: { from: '2026-10-20T03:30:00.000Z', to: '2026-10-20T04:00:00.000Z' },
      checkOutTime: { from: null, to: '2026-10-20T12:30:00.000Z' },
      durationMinutes: { from: null, to: 510 },
      status: { from: 'present', to: 'late' },
    });
  });

  it('applies the approval once: approving again changes nothing and writes no second audit entry', async () => {
    const recordId = await record('2026-10-21');
    const created = await request(recordId, '2026-10-21T03:30:00Z', '2026-10-21T12:00:00Z');
    await approve(created.approvalId as string);
    await pool.query(`UPDATE attendance_records SET notes = 'edited after' WHERE id = $1`, [
      recordId,
    ]);
    const again = await approve(created.approvalId as string);
    expect(again.status).toBe('approved');
    const row = await stored(recordId);
    expect(row?.check_out_time?.toISOString()).toBe('2026-10-21T12:00:00.000Z');
    const applied = (await auditActions(recordId)).filter(
      (e) => e.action === 'attendance.correction_apply',
    );
    expect(applied).toHaveLength(1);
  });

  it('two simultaneous approvals apply it exactly once', async () => {
    const recordId = await record('2026-10-22');
    const created = await request(recordId, '2026-10-22T03:30:00Z', '2026-10-22T13:00:00Z');
    const results = await Promise.allSettled([
      approve(created.approvalId as string),
      approve(created.approvalId as string),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const applied = (await auditActions(recordId)).filter(
      (e) => e.action === 'attendance.correction_apply',
    );
    expect(applied).toHaveLength(1);
    expect((await stored(recordId))?.duration_minutes).toBe(570);
  });

  it('a rejection leaves the record as it was', async () => {
    const recordId = await record('2026-10-23');
    const created = await request(recordId, '2026-10-23T03:30:00Z', '2026-10-23T14:00:00Z');
    await reject(created.approvalId as string);
    expect(await statusOf(created.id)).toBe('rejected');
    expect((await stored(recordId))?.duration_minutes).toBe(480);
    // And a new request is possible again.
    await expect(
      request(recordId, '2026-10-23T03:30:00Z', '2026-10-23T12:00:00Z'),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('allows one pending correction per record, even for two requests at once', async () => {
    const recordId = await record('2026-10-24');
    const results = await Promise.allSettled([
      request(recordId, '2026-10-24T03:30:00Z', '2026-10-24T12:00:00Z'),
      request(recordId, '2026-10-24T03:30:00Z', '2026-10-24T12:30:00Z'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ statusCode: 409 });
    const count = await pool.query(
      `SELECT 1 FROM attendance_corrections WHERE attendance_record_id = $1`,
      [recordId],
    );
    expect(count.rowCount).toBe(1);
    // The approval of the refused request was not left behind either.
    const approvalsLeft = await pool.query(
      `SELECT 1 FROM approvals a WHERE a.subject_type = 'attendance_correction'
        AND NOT EXISTS (SELECT 1 FROM attendance_corrections c WHERE c.id = a.subject_id)
        AND a.requester_employee_id = $1`,
      [ids.requester],
    );
    expect(approvalsLeft.rowCount).toBe(0);
  });

  it('the requester cancels a pending correction; a decided one cannot be cancelled', async () => {
    const recordId = await record('2026-10-25');
    const created = await request(recordId, '2026-10-25T03:30:00Z', '2026-10-25T12:00:00Z');
    const cancelled = await service.cancel(created.id, requesterCaller());
    expect(cancelled.status).toBe('cancelled');
    expect(await statusOf(created.id)).toBe('cancelled');
    await expect(approve(created.approvalId as string)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.cancel(created.id, requesterCaller())).rejects.toMatchObject({
      statusCode: 409,
    });

    const second = await request(recordId, '2026-10-25T03:30:00Z', '2026-10-25T12:00:00Z');
    await approve(second.approvalId as string);
    await expect(service.cancel(second.id, requesterCaller())).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('a cancel and an approval at the same moment end in one consistent state without deadlocking', async () => {
    const recordId = await record('2026-10-26');
    const created = await request(recordId, '2026-10-26T03:30:00Z', '2026-10-26T12:00:00Z');
    await Promise.allSettled([
      approve(created.approvalId as string),
      service.cancel(created.id, requesterCaller()),
    ]);
    const finalStatus = await statusOf(created.id);
    const approvalStatus = (
      await pool.query<{ status: string }>(`SELECT status FROM approvals WHERE id = $1`, [
        created.approvalId,
      ])
    ).rows[0]?.status;
    expect(finalStatus).toBe(approvalStatus);
    expect(['approved', 'cancelled']).toContain(finalStatus);
    const changed = (await stored(recordId))?.duration_minutes !== 480;
    expect(changed).toBe(finalStatus === 'approved');
  });

  it('refuses a record that is not the requester’s with the same 404 as a missing one', async () => {
    const others = await record('2026-10-20', { employeeId: ids.stranger });
    await expect(
      request(others, '2026-10-20T03:30:00Z', '2026-10-20T12:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      request(randomUUID(), '2026-10-20T03:30:00Z', '2026-10-20T12:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('allows records up to 30 days old and refuses older ones', async () => {
    // Today is 2026-10-31 on the company clock; 30 days back is 2026-10-01.
    const edge = await record('2026-10-01');
    await expect(
      request(edge, '2026-10-01T03:30:00Z', '2026-10-01T12:00:00Z'),
    ).resolves.toMatchObject({ status: 'pending' });
    const old = await record('2026-09-30');
    await expect(
      request(old, '2026-09-30T03:30:00Z', '2026-09-30T12:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it.each([
    ['check-out not after check-in', '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'],
    ['a session over 24 hours', '2026-10-19T03:30:00Z', '2026-10-20T04:00:00Z'],
    ['a check-in on another day', '2026-10-18T03:30:00Z', '2026-10-18T12:00:00Z'],
  ])('refuses %s', async (_name, checkIn, checkOut) => {
    const recordId = await record('2026-10-19');
    await expect(request(recordId, checkIn, checkOut)).rejects.toMatchObject({
      statusCode: 422,
    });
    const none = await pool.query(
      `SELECT 1 FROM attendance_corrections WHERE attendance_record_id = $1`,
      [recordId],
    );
    expect(none.rowCount).toBe(0);
  });

  it('refuses a check-out in the future, and allows one at this very moment', async () => {
    // The record is today's, so the check-in date is right and only the future rule can refuse it.
    const recordId = await record('2026-10-31');
    await expect(
      request(recordId, '2026-10-31T03:30:00Z', '2026-10-31T10:00:01Z'),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      request(recordId, '2026-10-31T03:30:00Z', '2026-10-31T10:00:00Z'),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('judges the work date on the company clock: 00:30 IST belongs to the IST date, not the UTC one', async () => {
    const recordId = await record('2026-10-17', {
      checkIn: '2026-10-16T19:30:00Z',
      checkOut: '2026-10-17T04:00:00Z',
    });
    await expect(
      request(recordId, '2026-10-16T19:00:00Z', '2026-10-17T05:00:00Z'),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('refuses times that overlap another session, and rolls an approval back when one appeared meanwhile', async () => {
    const first = await record('2026-10-15', {
      checkIn: '2026-10-15T03:30:00Z',
      checkOut: '2026-10-15T07:30:00Z',
    });
    await record('2026-10-15', {
      checkIn: '2026-10-15T09:00:00Z',
      checkOut: '2026-10-15T12:00:00Z',
    });
    await expect(
      request(first, '2026-10-15T03:30:00Z', '2026-10-15T10:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Valid today; then a session that overlaps is added before the decision.
    const second = await record('2026-10-14', {
      checkIn: '2026-10-14T03:30:00Z',
      checkOut: '2026-10-14T05:30:00Z',
    });
    const created = await request(second, '2026-10-14T03:30:00Z', '2026-10-14T08:00:00Z');
    await record('2026-10-14', {
      checkIn: '2026-10-14T07:00:00Z',
      checkOut: '2026-10-14T09:00:00Z',
    });
    await expect(approve(created.approvalId as string)).rejects.toMatchObject({ statusCode: 409 });

    // The decision was undone as a whole: approval and correction still pending, record untouched.
    expect(await statusOf(created.id)).toBe('pending');
    const approval = await pool.query<{ status: string }>(
      `SELECT status FROM approvals WHERE id = $1`,
      [created.approvalId],
    );
    expect(approval.rows[0]?.status).toBe('pending');
    expect((await stored(second))?.check_out_time?.toISOString()).toBe('2026-10-14T05:30:00.000Z');
    // The approver can still reject it.
    await expect(reject(created.approvalId as string)).resolves.toMatchObject({
      status: 'rejected',
    });
  });

  it('refuses an open session of the requester that would overlap (an open session runs on)', async () => {
    const open = await record('2026-10-13', {
      checkIn: '2026-10-13T11:00:00Z',
      checkOut: null,
    });
    expect(open).toBeTruthy();
    const earlier = await record('2026-10-13', {
      checkIn: '2026-10-13T03:30:00Z',
      checkOut: '2026-10-13T05:30:00Z',
    });
    await expect(
      request(earlier, '2026-10-13T03:30:00Z', '2026-10-13T12:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 409 });
    await pool.query(`UPDATE attendance_records SET check_out_time = check_in_time WHERE id = $1`, [
      open,
    ]);
  });

  it('an approver in scope reads it, a stranger does not', async () => {
    const recordId = await record('2026-10-12');
    const created = await request(recordId, '2026-10-12T03:30:00Z', '2026-10-12T12:00:00Z');
    const manager = { actorId: randomUUID(), employeeId: ids.manager };
    const teamScope = toScopeFilter('team', { employeeId: ids.manager });
    await expect(service.get(created.id, manager, teamScope)).resolves.toMatchObject({
      id: created.id,
    });
    const stranger = { actorId: randomUUID(), employeeId: ids.stranger };
    await expect(
      service.get(created.id, stranger, toScopeFilter('team', { employeeId: ids.stranger })),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      service.get(created.id, requesterCaller(), { kind: 'none' }),
    ).resolves.toMatchObject({ id: created.id });
  });

  it('the database refuses out-of-order times and a second pending correction on its own', async () => {
    const recordId = await record('2026-10-11');
    await expect(
      pool.query(
        `INSERT INTO attendance_corrections
           (attendance_record_id, employee_id, original_check_in, requested_check_in, requested_check_out, reason)
         VALUES ($1, $2, NOW(), '2026-10-11T10:00:00Z', '2026-10-11T09:00:00Z', 'x')`,
        [recordId, ids.requester],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const insert = () =>
      pool.query(
        `INSERT INTO attendance_corrections
           (attendance_record_id, employee_id, original_check_in, requested_check_in, requested_check_out, reason)
         VALUES ($1, $2, NOW(), '2026-10-11T09:00:00Z', '2026-10-11T10:00:00Z', 'x')`,
        [recordId, ids.requester],
      );
    await insert();
    await expect(insert()).rejects.toMatchObject({ code: '23505' });
  });
});
