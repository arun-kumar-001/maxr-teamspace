import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgNotificationsRepository } from './notifications.repository';

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The shared
 * development database may hold other employees, so checks name the fixtures they care about.
 */
describe('notifications against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgNotificationsRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT notif_tx',
      COMMIT: 'RELEASE SAVEPOINT notif_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT notif_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const employee = async (
    name: string,
    options: { role?: string; managerId?: string; status?: string; userActive?: boolean } = {},
  ) => {
    const id = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, manager_id, status)
         VALUES ($1, $2, 'Notify', $3, $4, $5, $6, $7) RETURNING id`,
        [
          `NT-${run}-${name}`,
          name,
          `${name}-${run}@notify.test`,
          ids.dept,
          ids.desig,
          options.managerId ?? null,
          options.status ?? 'active',
        ],
      )
    ).rows[0]?.id as string;
    if (options.role) {
      const user = await outer.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', $3) RETURNING id`,
        [id, `${name}-${run}@notify.test`, options.userActive ?? true],
      );
      await outer.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
        [user.rows[0]?.id, options.role],
      );
    }
    return id;
  };
  const make = (recipient: string, key: string | null = null, title = 'Leave request approved') =>
    repo.insert({
      recipientEmployeeId: recipient,
      type: 'approval.approved',
      title,
      body: 'Open it to see the details.',
      link: '/approvals/1',
      dedupeKey: key,
    });

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgNotificationsRepository(() => nested(outer));
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Notify ${run}`, `NT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `NT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.boss = await employee('boss', { role: 'team_lead' });
    ids.staff = await employee('staff', { role: 'staff', managerId: ids.boss });
    ids.hr = await employee('hr', { role: 'hr_manager' });
    ids.admin = await employee('admin', { role: 'admin' });
    ids.hrOff = await employee('hroff', { role: 'hr_manager', userActive: false });
    ids.gone = await employee('gone', { role: 'hr_manager', status: 'deactivated' });
    ids.plain = await employee('plain');
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  describe('the migration', () => {
    const refused = async (sql: string, values: unknown[]) => {
      await outer.query('SAVEPOINT refusal');
      const err = await outer.query(sql, values).then(
        () => null,
        (e: { code?: string }) => e,
      );
      await outer.query('ROLLBACK TO SAVEPOINT refusal');
      return err?.code ?? null;
    };

    it('refuses a link that is not a path inside the app, a blank title and a malformed type', async () => {
      const insert = (type: string, title: string, link: string | null) =>
        refused(
          `INSERT INTO notifications (recipient_employee_id, type, title, body, link) VALUES ($1, $2, $3, 'b', $4)`,
          [ids.staff, type, title, link],
        );
      expect(await insert('approval.approved', 'ok', '/approvals/1')).toBeNull();
      expect(await insert('approval.approved', 'ok', 'https://evil.example')).toBe('23514');
      expect(await insert('approval.approved', 'ok', '//evil.example')).toBe('23514'); // another site, to a browser
      expect(await insert('approval.approved', 'ok', '/')).toBeNull();
      expect(await insert('approval.approved', 'ok', '/a b')).toBe('23514');
      expect(await insert('approval.approved', '   ', null)).toBe('23514');
      expect(await insert('Approval Approved', 'ok', null)).toBe('23514');
    });
  });

  describe('the inbox', () => {
    it('creates a notification once per recipient and dedupe key, and again for another recipient', async () => {
      expect(await make(ids.staff as string, 'k1')).not.toBeNull();
      expect(await make(ids.staff as string, 'k1')).toBeNull();
      expect(await make(ids.boss as string, 'k1')).not.toBeNull();
      // No key: always a new one.
      expect(await make(ids.staff as string)).not.toBeNull();
      expect(await make(ids.staff as string)).not.toBeNull();
      const mine = await repo.list(ids.staff as string, {
        unreadOnly: false,
        offset: 0,
        limit: 20,
      });
      expect(mine.total).toBe(3);
    });

    it('lists only the recipient’s own, newest first, with the unread count', async () => {
      await outer.query(
        `INSERT INTO notifications (recipient_employee_id, type, title, body, created_at) VALUES
           ($1, 'announcement', 'old', 'b', NOW() - INTERVAL '2 days'),
           ($1, 'announcement', 'new', 'b', NOW() - INTERVAL '1 day'),
           ($2, 'announcement', 'theirs', 'b', NOW())`,
        [ids.staff, ids.boss],
      );
      const staff = await repo.list(ids.staff as string, {
        unreadOnly: false,
        offset: 0,
        limit: 20,
      });
      expect(staff.items.map((n) => n.title)).toEqual(['new', 'old']);
      expect(staff).toMatchObject({ total: 2, unread: 2 });
      const first = staff.items[0];
      await repo.markRead(first?.id ?? '', ids.staff as string);
      const unreadOnly = await repo.list(ids.staff as string, {
        unreadOnly: true,
        offset: 0,
        limit: 20,
      });
      expect(unreadOnly.items.map((n) => n.title)).toEqual(['old']);
      expect(unreadOnly).toMatchObject({ total: 1, unread: 1 });
      const paged = await repo.list(ids.staff as string, {
        unreadOnly: false,
        offset: 1,
        limit: 1,
      });
      expect(paged.items.map((n) => n.title)).toEqual(['old']);
      expect(paged.total).toBe(2);
    });

    it('marks only the recipient’s own notification read, once', async () => {
      const mine = await make(ids.staff as string, 'a');
      const theirs = await make(ids.boss as string, 'b');
      expect(await repo.markRead(theirs?.id ?? '', ids.staff as string)).toBeNull();
      const first = await repo.markRead(mine?.id ?? '', ids.staff as string);
      expect(first?.readAt).not.toBeNull();
      await outer.query(`SELECT pg_sleep(0.01)`);
      const again = await repo.markRead(mine?.id ?? '', ids.staff as string);
      expect(again?.readAt).toBe(first?.readAt);
      const untouched = await repo.list(ids.boss as string, {
        unreadOnly: true,
        offset: 0,
        limit: 20,
      });
      expect(untouched.total).toBe(1);
    });

    it('marks all of the recipient’s own read and nobody else’s', async () => {
      await make(ids.staff as string, 'a');
      await make(ids.staff as string, 'b');
      await make(ids.boss as string, 'c');
      expect(await repo.markAllRead(ids.staff as string)).toBe(2);
      expect(await repo.markAllRead(ids.staff as string)).toBe(0);
      expect(
        (await repo.list(ids.boss as string, { unreadOnly: true, offset: 0, limit: 5 })).total,
      ).toBe(1);
    });
  });

  describe('announcements and retention', () => {
    it('reach every active employee and nobody who is deactivated', async () => {
      const created = await repo.announce(outer, 'Office closed', 'Closed on Friday.');
      expect(created).toBeGreaterThanOrEqual(5);
      const titleOf = async (id: string) =>
        (await repo.list(id, { unreadOnly: false, offset: 0, limit: 5 })).items.map((n) => n.title);
      for (const id of [ids.staff, ids.boss, ids.hr, ids.admin, ids.plain]) {
        expect(await titleOf(id as string), id).toEqual(['Office closed']);
      }
      expect(await titleOf(ids.gone as string)).toEqual([]);
    });

    it('removes read notifications older than the cutoff and keeps unread and recent ones', async () => {
      await outer.query(
        `INSERT INTO notifications (recipient_employee_id, type, title, body, read_at) VALUES
           ($1, 'announcement', 'old read', 'b', NOW() - INTERVAL '100 days'),
           ($1, 'announcement', 'recent read', 'b', NOW() - INTERVAL '10 days'),
           ($1, 'announcement', 'old unread', 'b', NULL)`,
        [ids.staff],
      );
      await outer.query(
        `UPDATE notifications SET created_at = NOW() - INTERVAL '200 days' WHERE title = 'old unread'`,
      );
      const removed = await repo.deleteReadBefore(new Date(Date.now() - 90 * 24 * 3600 * 1000));
      expect(removed).toBeGreaterThanOrEqual(1);
      const left = await repo.list(ids.staff as string, {
        unreadOnly: false,
        offset: 0,
        limit: 20,
      });
      expect(left.items.map((n) => n.title).sort()).toEqual(['old unread', 'recent read']);
    });
  });

  describe('recipients', () => {
    it('finds an active employee, and nobody who is deactivated', async () => {
      expect(await repo.findRecipient(ids.staff as string)).toEqual({
        employeeId: ids.staff,
        email: `staff-${run}@notify.test`,
      });
      expect(await repo.findRecipient(ids.gone as string)).toBeNull();
      expect(await repo.findRecipient(randomUUID())).toBeNull();
    });

    it('finds the manager of an employee, if they are active', async () => {
      expect((await repo.findManagerOf(ids.staff as string))?.employeeId).toBe(ids.boss);
      expect(await repo.findManagerOf(ids.boss as string)).toBeNull();
      await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.boss]);
      expect(await repo.findManagerOf(ids.staff as string)).toBeNull();
    });

    it('finds the active HR Managers and Admins except the requester', async () => {
      const found = (await repo.findHrApprovers(ids.staff as string)).map((r) => r.employeeId);
      expect(found).toEqual(expect.arrayContaining([ids.hr, ids.admin]));
      // A team lead, a plain employee, an account that is switched off and a deactivated employee are not approvers.
      for (const id of [ids.boss, ids.staff, ids.plain, ids.hrOff, ids.gone]) {
        expect(found, id).not.toContain(id);
      }
      const forHr = (await repo.findHrApprovers(ids.hr as string)).map((r) => r.employeeId);
      expect(forHr).toContain(ids.admin);
      expect(forHr).not.toContain(ids.hr);
    });
  });

  describe('stale approvals', () => {
    const approval = async (
      stages: string[],
      currentStage: number,
      createdHoursAgo: number,
      status = 'pending',
    ) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO approvals (subject_type, subject_id, requester_employee_id, stages, current_stage, status, created_at, decided_at)
           VALUES ('leave_request', gen_random_uuid(), $1, $2, $3, $4::varchar, NOW() - make_interval(hours => $5),
                   CASE WHEN $4::varchar = 'pending' THEN NULL ELSE NOW() END)
           RETURNING id`,
          [ids.staff, stages, currentStage, status, createdHoursAgo],
        )
      ).rows[0]?.id as string;
    const decide = (approvalId: string, stage: number, hoursAgo: number) =>
      outer.query(
        `INSERT INTO approval_decisions (approval_id, stage, decided_by_employee_id, outcome, decided_at)
         VALUES ($1, $2, $3, 'approved', NOW() - make_interval(hours => $4))`,
        [approvalId, stage, ids.boss, hoursAgo],
      );
    const stale = async (hours = 24) =>
      repo.findStaleApprovals(new Date(Date.now() - hours * 3600 * 1000));

    it('lists a pending approval that has waited more than the cutoff, with its current step', async () => {
      const old = await approval(['manager'], 0, 30);
      const fresh = await approval(['manager'], 0, 5);
      const found = await stale();
      expect(found.find((s) => s.approvalId === old)).toEqual({
        approvalId: old,
        subjectType: 'leave_request',
        requesterEmployeeId: ids.staff,
        stage: 'manager',
      });
      expect(found.map((s) => s.approvalId)).not.toContain(fresh);
    });

    it('counts the wait from the previous decision, not from the request', async () => {
      const recent = await approval(['manager', 'hr'], 1, 40);
      await decide(recent, 0, 5); // the manager approved 5 hours ago; HR has waited only 5
      const waiting = await approval(['manager', 'hr'], 1, 60);
      await decide(waiting, 0, 30); // HR has waited 30 hours
      const found = await stale();
      expect(found.map((s) => s.approvalId)).not.toContain(recent);
      expect(found.find((s) => s.approvalId === waiting)?.stage).toBe('hr');
    });

    it('ignores approvals that are no longer pending', async () => {
      const done = await approval(['manager'], 0, 100, 'approved');
      const cancelled = await approval(['manager'], 0, 100, 'cancelled');
      const ids2 = (await stale()).map((s) => s.approvalId);
      expect(ids2).not.toContain(done);
      expect(ids2).not.toContain(cancelled);
    });
  });
});
