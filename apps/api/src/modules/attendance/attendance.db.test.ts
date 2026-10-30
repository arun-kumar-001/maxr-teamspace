import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { ScopeFilter } from '../rbac/scope';
import { PgAttendanceRepository } from './attendance.repository';

describe('PgAttendanceRepository (PostgreSQL Integration - Issue #34)', () => {
  const pool = getPool();
  const repo = new PgAttendanceRepository(getPool);

  let deptId: string;
  let desigId: string;
  const ids: Record<string, string> = {};
  const createdRecordIds: string[] = [];
  const createdEmployeeIds: string[] = [];

  beforeAll(async () => {
    // 1. Create isolated department and designation
    const deptCode = `ATT_D_${randomUUID().slice(0, 6)}`;
    const deptRes = await pool.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ('Attendance Test Dept', $1) RETURNING id`,
      [deptCode],
    );
    deptId = deptRes.rows[0]!.id;

    const desigRes = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Attendance Tester', $2) RETURNING id`,
      [deptId, `ATT_DSG_${randomUUID().slice(0, 6)}`],
    );
    desigId = desigRes.rows[0]!.id;

    // 2. Create test employees: lead -> (anna, ben); carl has no manager; dave is deactivated
    const addEmployee = async (name: string, managerId?: string, status = 'active') => {
      const empCode = `ATT_${name.toUpperCase()}_${randomUUID().slice(0, 6)}`;
      const res = await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id, status)
         VALUES ($1, $2, 'Test', $3, $4, $5, $6, $7) RETURNING id`,
        [
          empCode,
          name,
          `${name}_${randomUUID().slice(0, 6)}@attendance.test`,
          deptId,
          desigId,
          managerId ?? null,
          status,
        ],
      );
      const id = res.rows[0]!.id;
      ids[name] = id;
      createdEmployeeIds.push(id);
      return id;
    };

    await addEmployee('lead');
    await addEmployee('anna', ids.lead);
    await addEmployee('ben', ids.lead);
    await addEmployee('carl');
    await addEmployee('dave', undefined, 'deactivated');
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await pool.query('DELETE FROM attendance_records WHERE id = ANY($1)', [createdRecordIds]);
    }
    if (createdEmployeeIds.length > 0) {
      await pool.query('DELETE FROM employees WHERE id = ANY($1)', [createdEmployeeIds]);
    }
    if (desigId) {
      await pool.query('DELETE FROM designations WHERE id = $1', [desigId]);
    }
    if (deptId) {
      await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
    }
    await closePool();
  });

  it('guarantees at most one open attendance session per employee (concurrent double check-in returns 409)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const empId = ids.anna!;

    // 1. Initial check-in (open session) succeeds
    const firstSession = await repo.createCheckIn(empId, today, { notes: 'first check in' });
    createdRecordIds.push(firstSession.id);
    expect(firstSession.id).toBeDefined();
    expect(firstSession.checkOutTime).toBeNull();
    expect(firstSession.status).toBe('PRESENT');

    // 2. Concurrent second check-in while previous session is open returns 409 Conflict
    await expect(
      repo.createCheckIn(empId, today, { notes: 'concurrent second check in' }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    // 3. Active session lookup finds the open session
    const active = await repo.findActiveSession(empId);
    expect(active).not.toBeNull();
    expect(active?.id).toBe(firstSession.id);

    // 4. Check out the active session
    const nowIso = new Date().toISOString();
    const closed = await repo.createCheckOut(firstSession.id, nowIso, 240, 'checked out');
    expect(closed).not.toBeNull();
    expect(closed?.checkOutTime).toBe(nowIso);
    expect(closed?.durationMinutes).toBe(240);

    // 5. Active session lookup now returns null
    const activeAfterClose = await repo.findActiveSession(empId);
    expect(activeAfterClose).toBeNull();

    // 6. Second check-in now succeeds (since check_out_time is no longer NULL)
    const secondSession = await repo.createCheckIn(empId, today, { notes: 'second session' });
    createdRecordIds.push(secondSession.id);
    expect(secondSession.id).toBeDefined();
    expect(secondSession.id).not.toBe(firstSession.id);
  });

  it('returns null when checking out without an open session or non-existent session', async () => {
    const fakeId = randomUUID();
    const result = await repo.createCheckOut(fakeId, new Date().toISOString(), 60);
    expect(result).toBeNull();
  });

  it('blocks deactivated employees from checking in with 403 Forbidden', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const deactivatedEmpId = ids.dave!;

    await expect(
      repo.createCheckIn(deactivatedEmpId, today, { notes: 'deactivated check in' }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('enforces RBAC scope SQL correctly across roles using PgAttendanceRepository', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Seed attendance for ben and carl
    const sBen = await repo.createCheckIn(ids.ben!, today, { notes: 'ben shift' });
    createdRecordIds.push(sBen.id);
    const sCarl = await repo.createCheckIn(ids.carl!, today, { notes: 'carl shift' });
    createdRecordIds.push(sCarl.id);

    const queryWithScope = async (scope: ScopeFilter) => {
      const res = await repo.findMany(
        {
          offset: 0,
          limit: 50,
          sort: { column: 'workDate', order: 'desc' },
          startDate: today,
          endDate: today,
        },
        scope,
      );
      return res.items.map((i) => i.employeeId);
    };

    // 1. Admin / HR ('all') sees all records
    const allIds = await queryWithScope({ kind: 'all' });
    expect(allIds).toContain(ids.anna);
    expect(allIds).toContain(ids.ben);
    expect(allIds).toContain(ids.carl);

    // 2. Team Lead ('team') sees direct reports (anna and ben), NOT carl or self
    const teamIds = await queryWithScope({ kind: 'team', managerId: ids.lead! });
    expect(teamIds).toContain(ids.anna);
    expect(teamIds).toContain(ids.ben);
    expect(teamIds).not.toContain(ids.carl);
    expect(teamIds).not.toContain(ids.lead);

    // 3. Staff ('own') sees only own records
    const ownIds = await queryWithScope({ kind: 'own', employeeId: ids.ben! });
    expect(ownIds).toContain(ids.ben);
    expect(ownIds).not.toContain(ids.anna);
    expect(ownIds).not.toContain(ids.carl);

    // 4. Denied scope ('none') sees nothing
    const noIds = await queryWithScope({ kind: 'none' });
    expect(noIds).toEqual([]);
  });
});
