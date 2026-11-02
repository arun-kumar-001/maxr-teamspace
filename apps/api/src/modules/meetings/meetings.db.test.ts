import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { PgMeetingsRepository } from './meetings.repository';
import { MeetingsService } from './meetings.service';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('meetings against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgMeetingsRepository;
  let service: MeetingsService;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const NOW = new Date('2026-11-01T10:00:00Z');

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT meeting_tx',
      COMMIT: 'RELEASE SAVEPOINT meeting_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT meeting_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const employee = async (name: string, status = 'active') =>
    (ids[name] = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
         VALUES ($1, $2, 'Mt', $3, $4, $5, $6) RETURNING id`,
        [`MT-${run}-${name}`, name, `${name}-${run}@meet.test`, ids.dept, ids.desig, status],
      )
    ).rows[0]?.id as string);
  const meeting = async (
    organizer: string,
    startsAt: string,
    endsAt: string,
    invitees: string[] = [],
    status = 'scheduled',
  ) => {
    const res = await outer.query<{ id: string }>(
      `INSERT INTO meetings (title, organizer_employee_id, starts_at, ends_at, status)
       VALUES ('m', $1, $2, $3, $4) RETURNING id`,
      [ids[organizer], startsAt, endsAt, status],
    );
    const id = res.rows[0]?.id as string;
    for (const who of invitees) {
      await outer.query(`INSERT INTO meeting_attendees (meeting_id, employee_id) VALUES ($1, $2)`, [
        id,
        ids[who],
      ]);
    }
    return id;
  };
  const refused = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    repo = new PgMeetingsRepository(() => nested(outer));
    service = new MeetingsService(repo, platform, () => NOW);
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Meet ${run}`, `MT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `MT-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['org', 'amy', 'ben', 'cat']) await employee(name);
    await employee('gone', 'deactivated');
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
    it('refuses an end that is not after the start, a meeting longer than a day, minutes over 20,000 characters and an unknown RSVP', async () => {
      const insert = (starts: string, ends: string, minutes: string | null = null) =>
        refused(
          `INSERT INTO meetings (title, organizer_employee_id, starts_at, ends_at, minutes) VALUES ('m', $1, $2, $3, $4)`,
          [ids.org, starts, ends, minutes],
        );
      expect(await insert('2026-11-10T05:00:00Z', '2026-11-10T04:00:00Z')).toBe('23514');
      expect(await insert('2026-11-10T04:00:00Z', '2026-11-11T05:00:00Z')).toBe('23514');
      expect(await insert('2026-11-10T04:00:00Z', '2026-11-10T05:00:00Z', 'x'.repeat(20001))).toBe(
        '23514',
      );
      expect(await insert('2026-11-10T04:00:00Z', '2026-11-10T05:00:00Z')).toBeNull();
      const id = await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z');
      expect(
        await refused(
          `INSERT INTO meeting_attendees (meeting_id, employee_id, rsvp) VALUES ($1, $2, 'maybe')`,
          [id, ids.amy],
        ),
      ).toBe('23514');
    });

    it('lets an employee be invited to a meeting once', async () => {
      const id = await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['amy']);
      expect(
        await refused(`INSERT INTO meeting_attendees (meeting_id, employee_id) VALUES ($1, $2)`, [
          id,
          ids.amy,
        ]),
      ).toBe('23505');
    });
  });

  describe('visibility', () => {
    it('shows a meeting to its organizer and invitees only', async () => {
      const id = await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['amy']);
      expect(await repo.find(id, ids.org as string)).not.toBeNull();
      expect(await repo.find(id, ids.amy as string)).not.toBeNull();
      expect(await repo.find(id, ids.ben as string)).toBeNull();
    });

    it('lists only the meetings in the window that the viewer organises or is invited to', async () => {
      await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['amy']);
      await meeting('org', '2026-11-12T06:00:00Z', '2026-11-12T07:00:00Z', ['ben']);
      await meeting('org', '2026-12-12T04:00:00Z', '2026-12-12T05:00:00Z', ['amy']);
      const amy = await repo.list({
        viewerId: ids.amy as string,
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T00:00:00Z',
        offset: 0,
        limit: 20,
      });
      expect(amy.total).toBe(1);
      expect(amy.items[0]).toMatchObject({
        myRole: 'invitee',
        myRsvp: 'pending',
        attendeeCount: 1,
      });
      const organiser = await repo.list({
        viewerId: ids.org as string,
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T00:00:00Z',
        offset: 0,
        limit: 20,
      });
      expect(organiser.total).toBe(2);
      expect(organiser.items.every((m) => m.myRole === 'organizer')).toBe(true);
    });

    it('does not list a window edge that only touches a meeting', async () => {
      await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['amy']);
      const touching = await repo.list({
        viewerId: ids.amy as string,
        from: '2026-11-12T05:00:00Z',
        to: '2026-11-12T06:00:00Z',
        offset: 0,
        limit: 20,
      });
      expect(touching.total).toBe(0);
    });
  });

  describe('overlaps and reminders', () => {
    it('finds other scheduled meetings that overlap for the given people, and ignores cancelled ones', async () => {
      const busy = await meeting('amy', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['ben']);
      await meeting('cat', '2026-11-12T04:30:00Z', '2026-11-12T05:30:00Z', [], 'cancelled');
      const hits = await repo.transaction((tx) =>
        repo.overlaps(
          tx,
          [ids.amy as string, ids.ben as string, ids.cat as string],
          '2026-11-12T04:30:00Z',
          '2026-11-12T06:00:00Z',
          null,
        ),
      );
      expect(hits.map((h) => [h.employeeId, h.meetingId]).sort()).toEqual(
        [
          [ids.amy, busy],
          [ids.ben, busy],
        ].sort(),
      );
      const excluded = await repo.transaction((tx) =>
        repo.overlaps(
          tx,
          [ids.amy as string],
          '2026-11-12T04:30:00Z',
          '2026-11-12T06:00:00Z',
          busy,
        ),
      );
      expect(excluded).toEqual([]);
    });

    it('reminds once, only meetings starting within 15 minutes, and not invitees who declined', async () => {
      const soon = await meeting('org', '2026-11-01T10:10:00Z', '2026-11-01T11:00:00Z', [
        'amy',
        'ben',
      ]);
      await meeting('org', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z', ['amy']);
      await outer.query(
        `UPDATE meeting_attendees SET rsvp = 'declined' WHERE meeting_id = $1 AND employee_id = $2`,
        [soon, ids.ben],
      );
      const due = await repo.dueReminders(NOW, 15);
      expect(due.map((d) => d.meetingId)).toEqual([soon]);
      expect(due[0]?.recipientEmployeeIds).toEqual([ids.amy]);
      expect(await repo.transaction((tx) => repo.claimReminder(tx, soon))).toBe(true);
      expect(await repo.transaction((tx) => repo.claimReminder(tx, soon))).toBe(false);
      expect(await repo.dueReminders(NOW, 15)).toEqual([]);
    });

    it('the service shows a meeting only to its organizer and invitees', async () => {
      const id = await meeting('org', '2026-11-12T04:00:00Z', '2026-11-12T05:00:00Z', ['amy']);
      await expect(service.get(id, ids.ben as string)).rejects.toMatchObject({ statusCode: 404 });
      const got = await service.get(id, ids.org as string);
      expect(got.attendees.map((a) => a.employeeId)).toEqual([ids.amy]);
    });
  });
});
