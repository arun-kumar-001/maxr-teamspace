import type { PoolClient } from 'pg';
import {
  Attendee,
  Meeting,
  MeetingSummary,
  MeetingTx,
  MeetingValues,
  Overlap,
  PoolGetter,
  Rsvp,
} from './meetings.types';

export interface IMeetingsRepository {
  transaction<T>(work: (tx: MeetingTx) => Promise<T>): Promise<T>;
  /** The ids that are active employees, read under a share lock. */
  activeEmployees(tx: MeetingTx, ids: string[]): Promise<Set<string>>;
  insert(
    tx: MeetingTx,
    organizerId: string,
    values: MeetingValues,
    inviteeIds: string[],
  ): Promise<string>;
  /** Locks the meeting until the transaction ends; null when it does not exist. */
  lockForUpdate(tx: MeetingTx, id: string): Promise<Meeting | null>;
  update(tx: MeetingTx, id: string, values: MeetingValues): Promise<void>;
  /** Makes the invitee list exactly `inviteeIds`; returns who was added and who was removed. */
  replaceAttendees(
    tx: MeetingTx,
    id: string,
    inviteeIds: string[],
  ): Promise<{ added: string[]; removed: string[] }>;
  setRsvp(tx: MeetingTx, id: string, employeeId: string, rsvp: Rsvp): Promise<boolean>;
  cancel(tx: MeetingTx, id: string): Promise<void>;
  /** One meeting, only when `viewerId` organises it or is invited. */
  find(id: string, viewerId: string): Promise<Meeting | null>;
  list(params: {
    viewerId: string;
    from: string;
    to: string;
    offset: number;
    limit: number;
  }): Promise<{ items: MeetingSummary[]; total: number }>;
  /** Other scheduled meetings that overlap the window for any of `employeeIds`. */
  overlaps(
    tx: MeetingTx,
    employeeIds: string[],
    startsAt: string,
    endsAt: string,
    excludeId: string | null,
  ): Promise<Overlap[]>;
  /** Meetings starting within `withinMinutes` that have not been reminded yet. */
  dueReminders(
    now: Date,
    withinMinutes: number,
  ): Promise<Array<{ meetingId: string; startsAt: string; recipientEmployeeIds: string[] }>>;
  /** Marks a meeting reminded; false when someone else already did. */
  claimReminder(tx: MeetingTx, meetingId: string): Promise<boolean>;
}

interface MeetingRow {
  id: string;
  title: string;
  agenda: string | null;
  minutes: string | null;
  organizer_employee_id: string;
  organizer_name: string;
  starts_at: Date;
  ends_at: Date;
  status: 'scheduled' | 'cancelled';
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface AttendeeRow {
  meeting_id: string;
  employee_id: string;
  name: string;
  rsvp: Rsvp;
  responded_at: Date | null;
}

const iso = (value: Date): string => value.toISOString();

const SELECT = `
  SELECT m.id, m.title, m.agenda, m.minutes, m.organizer_employee_id,
         o.first_name || ' ' || o.last_name AS organizer_name, m.starts_at, m.ends_at, m.status,
         m.version, m.created_at, m.updated_at
    FROM meetings m JOIN employees o ON o.id = m.organizer_employee_id`;

const ATTENDEES = `
  SELECT a.meeting_id, a.employee_id, e.first_name || ' ' || e.last_name AS name, a.rsvp, a.responded_at
    FROM meeting_attendees a JOIN employees e ON e.id = a.employee_id`;

const toMeeting = (row: MeetingRow, attendees: Attendee[]): Meeting => ({
  id: row.id,
  title: row.title,
  agenda: row.agenda,
  minutes: row.minutes,
  organizerEmployeeId: row.organizer_employee_id,
  organizerName: row.organizer_name,
  startsAt: iso(row.starts_at),
  endsAt: iso(row.ends_at),
  status: row.status,
  version: row.version,
  attendees,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const toAttendee = (row: AttendeeRow): Attendee => ({
  employeeId: row.employee_id,
  name: row.name,
  rsvp: row.rsvp,
  respondedAt: row.responded_at ? iso(row.responded_at) : null,
});

export class PgMeetingsRepository implements IMeetingsRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: MeetingTx) => Promise<T>): Promise<T> {
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

  async activeEmployees(tx: MeetingTx, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const res = await tx.query<{ id: string }>(
      `SELECT id FROM employees WHERE id = ANY($1::uuid[]) AND status = 'active' FOR SHARE`,
      [ids],
    );
    return new Set(res.rows.map((row) => row.id));
  }

  async insert(
    tx: MeetingTx,
    organizerId: string,
    values: MeetingValues,
    inviteeIds: string[],
  ): Promise<string> {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO meetings (title, agenda, minutes, organizer_employee_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [values.title, values.agenda, values.minutes, organizerId, values.startsAt, values.endsAt],
    );
    const id = (res.rows[0] as { id: string }).id;
    if (inviteeIds.length > 0) {
      await tx.query(
        `INSERT INTO meeting_attendees (meeting_id, employee_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [id, inviteeIds],
      );
    }
    return id;
  }

  async lockForUpdate(tx: MeetingTx, id: string): Promise<Meeting | null> {
    const locked = await tx.query(`SELECT 1 FROM meetings WHERE id = $1 FOR UPDATE`, [id]);
    if (locked.rowCount === 0) return null;
    const row = await tx.query<MeetingRow>(`${SELECT} WHERE m.id = $1`, [id]);
    const people = await tx.query<AttendeeRow>(
      `${ATTENDEES} WHERE a.meeting_id = $1 ORDER BY name`,
      [id],
    );
    return toMeeting(row.rows[0] as MeetingRow, people.rows.map(toAttendee));
  }

  async update(tx: MeetingTx, id: string, values: MeetingValues): Promise<void> {
    await tx.query(
      `UPDATE meetings
          SET title = $2, agenda = $3, minutes = $4, starts_at = $5, ends_at = $6,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      [id, values.title, values.agenda, values.minutes, values.startsAt, values.endsAt],
    );
  }

  async replaceAttendees(
    tx: MeetingTx,
    id: string,
    inviteeIds: string[],
  ): Promise<{ added: string[]; removed: string[] }> {
    const removed = await tx.query<{ employee_id: string }>(
      `DELETE FROM meeting_attendees
        WHERE meeting_id = $1 AND NOT (employee_id = ANY($2::uuid[]))
        RETURNING employee_id`,
      [id, inviteeIds],
    );
    const added = await tx.query<{ employee_id: string }>(
      `INSERT INTO meeting_attendees (meeting_id, employee_id)
       SELECT $1, UNNEST($2::uuid[])
       ON CONFLICT (meeting_id, employee_id) DO NOTHING
       RETURNING employee_id`,
      [id, inviteeIds],
    );
    return {
      added: added.rows.map((row) => row.employee_id),
      removed: removed.rows.map((row) => row.employee_id),
    };
  }

  async setRsvp(tx: MeetingTx, id: string, employeeId: string, rsvp: Rsvp): Promise<boolean> {
    const res = await tx.query(
      `UPDATE meeting_attendees SET rsvp = $3, responded_at = NOW()
        WHERE meeting_id = $1 AND employee_id = $2`,
      [id, employeeId, rsvp],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async cancel(tx: MeetingTx, id: string): Promise<void> {
    await tx.query(
      `UPDATE meetings SET status = 'cancelled', version = version + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async find(id: string, viewerId: string): Promise<Meeting | null> {
    const visible = `(m.organizer_employee_id = $2 OR EXISTS (
      SELECT 1 FROM meeting_attendees v WHERE v.meeting_id = m.id AND v.employee_id = $2))`;
    const row = await this.getPool().query<MeetingRow>(`${SELECT} WHERE m.id = $1 AND ${visible}`, [
      id,
      viewerId,
    ]);
    if (!row.rows[0]) return null;
    const people = await this.getPool().query<AttendeeRow>(
      `${ATTENDEES} WHERE a.meeting_id = $1 ORDER BY name`,
      [id],
    );
    return toMeeting(row.rows[0], people.rows.map(toAttendee));
  }

  async list(params: {
    viewerId: string;
    from: string;
    to: string;
    offset: number;
    limit: number;
  }) {
    const visible = `(m.organizer_employee_id = $1 OR EXISTS (
      SELECT 1 FROM meeting_attendees v WHERE v.meeting_id = m.id AND v.employee_id = $1))`;
    const where = `${visible} AND m.starts_at < $3::timestamptz AND m.ends_at > $2::timestamptz`;
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM meetings m WHERE ${where}`,
      [params.viewerId, params.from, params.to],
    );
    const rows = await this.getPool().query<
      MeetingRow & { my_rsvp: Rsvp | null; attendee_count: string }
    >(
      `SELECT m.id, m.title, m.agenda, m.minutes, m.organizer_employee_id,
              o.first_name || ' ' || o.last_name AS organizer_name, m.starts_at, m.ends_at, m.status,
              m.version, m.created_at, m.updated_at,
              (SELECT a.rsvp FROM meeting_attendees a WHERE a.meeting_id = m.id AND a.employee_id = $1) AS my_rsvp,
              (SELECT COUNT(*) FROM meeting_attendees a WHERE a.meeting_id = m.id) AS attendee_count
         FROM meetings m JOIN employees o ON o.id = m.organizer_employee_id
        WHERE ${where}
        ORDER BY m.starts_at, m.id
        LIMIT $4 OFFSET $5`,
      [params.viewerId, params.from, params.to, params.limit, params.offset],
    );
    return {
      items: rows.rows.map((row) => ({
        id: row.id,
        title: row.title,
        organizerEmployeeId: row.organizer_employee_id,
        organizerName: row.organizer_name,
        startsAt: iso(row.starts_at),
        endsAt: iso(row.ends_at),
        status: row.status,
        myRole:
          row.organizer_employee_id === params.viewerId
            ? ('organizer' as const)
            : ('invitee' as const),
        myRsvp: row.my_rsvp,
        attendeeCount: Number(row.attendee_count),
      })),
      total: Number(total.rows[0]?.count ?? 0),
    };
  }

  async overlaps(
    tx: MeetingTx,
    employeeIds: string[],
    startsAt: string,
    endsAt: string,
    excludeId: string | null,
  ): Promise<Overlap[]> {
    if (employeeIds.length === 0) return [];
    const res = await tx.query<{ employee_id: string; meeting_id: string }>(
      `SELECT DISTINCT p.employee_id, m.id AS meeting_id
         FROM meetings m
         JOIN (
           SELECT m2.id AS meeting_id, m2.organizer_employee_id AS employee_id FROM meetings m2
           UNION
           SELECT a.meeting_id, a.employee_id FROM meeting_attendees a
         ) p ON p.meeting_id = m.id
        WHERE p.employee_id = ANY($1::uuid[])
          AND m.status = 'scheduled'
          AND m.starts_at < $3::timestamptz AND m.ends_at > $2::timestamptz
          AND ($4::uuid IS NULL OR m.id <> $4::uuid)`,
      [employeeIds, startsAt, endsAt, excludeId],
    );
    return res.rows.map((row) => ({ employeeId: row.employee_id, meetingId: row.meeting_id }));
  }

  async dueReminders(
    now: Date,
    withinMinutes: number,
  ): Promise<Array<{ meetingId: string; startsAt: string; recipientEmployeeIds: string[] }>> {
    const res = await this.getPool().query<{ id: string; starts_at: Date; recipients: string[] }>(
      `SELECT m.id, m.starts_at,
              COALESCE(array_agg(a.employee_id) FILTER (WHERE a.rsvp <> 'declined'), '{}') AS recipients
         FROM meetings m
         LEFT JOIN meeting_attendees a ON a.meeting_id = m.id
        WHERE m.status = 'scheduled' AND m.reminder_sent_at IS NULL
          AND m.starts_at > $1::timestamptz
          AND m.starts_at <= $1::timestamptz + make_interval(mins => $2)
        GROUP BY m.id
        ORDER BY m.starts_at`,
      [now, withinMinutes],
    );
    return res.rows.map((row) => ({
      meetingId: row.id,
      startsAt: iso(row.starts_at),
      recipientEmployeeIds: row.recipients,
    }));
  }

  async claimReminder(tx: MeetingTx, meetingId: string): Promise<boolean> {
    const res = await tx.query(
      `UPDATE meetings SET reminder_sent_at = NOW() WHERE id = $1 AND reminder_sent_at IS NULL`,
      [meetingId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
