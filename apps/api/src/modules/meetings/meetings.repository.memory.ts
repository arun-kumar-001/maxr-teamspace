import { randomUUID } from 'node:crypto';
import { IMeetingsRepository } from './meetings.repository';
import {
  Attendee,
  Meeting,
  MeetingSummary,
  MeetingTx,
  MeetingValues,
  Overlap,
  Rsvp,
} from './meetings.types';

interface Stored {
  id: string;
  title: string;
  agenda: string | null;
  minutes: string | null;
  organizerEmployeeId: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'cancelled';
  version: number;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  attendees: Array<{ employeeId: string; rsvp: Rsvp; respondedAt: string | null }>;
}

/** In-memory meetings for unit and HTTP tests (not shipped in the build). */
export class MemoryMeetingsRepository implements IMeetingsRepository {
  meetings: Stored[] = [];
  names: Record<string, string> = {};
  active = new Set<string>();

  async transaction<T>(work: (tx: MeetingTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.meetings);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as MeetingTx);
    } catch (err) {
      this.meetings = snapshot;
      throw err;
    }
  }

  private name(id: string): string {
    return this.names[id] ?? id;
  }

  private attendeeView(m: Stored): Attendee[] {
    return m.attendees
      .map((a) => ({
        employeeId: a.employeeId,
        name: this.name(a.employeeId),
        rsvp: a.rsvp,
        respondedAt: a.respondedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private view(m: Stored): Meeting {
    return {
      id: m.id,
      title: m.title,
      agenda: m.agenda,
      minutes: m.minutes,
      organizerEmployeeId: m.organizerEmployeeId,
      organizerName: this.name(m.organizerEmployeeId),
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      status: m.status,
      version: m.version,
      attendees: this.attendeeView(m),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private visibleTo(m: Stored, viewerId: string): boolean {
    return m.organizerEmployeeId === viewerId || m.attendees.some((a) => a.employeeId === viewerId);
  }

  private overlapsWindow(m: Stored, from: string, to: string): boolean {
    return Date.parse(m.startsAt) < Date.parse(to) && Date.parse(m.endsAt) > Date.parse(from);
  }

  async activeEmployees(_tx: MeetingTx, ids: string[]): Promise<Set<string>> {
    return new Set(ids.filter((id) => this.active.has(id)));
  }

  async insert(
    _tx: MeetingTx,
    organizerId: string,
    values: MeetingValues,
    inviteeIds: string[],
  ): Promise<string> {
    const now = new Date().toISOString();
    const meeting: Stored = {
      id: randomUUID(),
      title: values.title,
      agenda: values.agenda,
      minutes: values.minutes,
      organizerEmployeeId: organizerId,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      status: 'scheduled',
      version: 1,
      reminderSent: false,
      createdAt: now,
      updatedAt: now,
      attendees: inviteeIds.map((employeeId) => ({
        employeeId,
        rsvp: 'pending' as Rsvp,
        respondedAt: null,
      })),
    };
    this.meetings.push(meeting);
    return meeting.id;
  }

  async lockForUpdate(_tx: MeetingTx, id: string): Promise<Meeting | null> {
    const found = this.meetings.find((m) => m.id === id);
    return found ? this.view(found) : null;
  }

  async update(_tx: MeetingTx, id: string, values: MeetingValues): Promise<void> {
    const found = this.meetings.find((m) => m.id === id);
    if (!found) return;
    Object.assign(found, values, {
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      version: found.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async replaceAttendees(_tx: MeetingTx, id: string, inviteeIds: string[]) {
    const found = this.meetings.find((m) => m.id === id);
    if (!found) return { added: [], removed: [] };
    const removed = found.attendees
      .filter((a) => !inviteeIds.includes(a.employeeId))
      .map((a) => a.employeeId);
    found.attendees = found.attendees.filter((a) => inviteeIds.includes(a.employeeId));
    const added = inviteeIds.filter(
      (employeeId) => !found.attendees.some((a) => a.employeeId === employeeId),
    );
    for (const employeeId of added)
      found.attendees.push({ employeeId, rsvp: 'pending', respondedAt: null });
    return { added, removed };
  }

  async setRsvp(_tx: MeetingTx, id: string, employeeId: string, rsvp: Rsvp): Promise<boolean> {
    const found = this.meetings.find((m) => m.id === id);
    const attendee = found?.attendees.find((a) => a.employeeId === employeeId);
    if (!attendee) return false;
    attendee.rsvp = rsvp;
    attendee.respondedAt = new Date().toISOString();
    return true;
  }

  async cancel(_tx: MeetingTx, id: string): Promise<void> {
    const found = this.meetings.find((m) => m.id === id);
    if (found) Object.assign(found, { status: 'cancelled', version: found.version + 1 });
  }

  async find(id: string, viewerId: string): Promise<Meeting | null> {
    const found = this.meetings.find((m) => m.id === id);
    return found && this.visibleTo(found, viewerId) ? this.view(found) : null;
  }

  async list(params: {
    viewerId: string;
    from: string;
    to: string;
    offset: number;
    limit: number;
  }) {
    const matching = this.meetings
      .filter(
        (m) => this.visibleTo(m, params.viewerId) && this.overlapsWindow(m, params.from, params.to),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
    const items: MeetingSummary[] = matching
      .slice(params.offset, params.offset + params.limit)
      .map((m) => {
        const mine = m.attendees.find((a) => a.employeeId === params.viewerId);
        return {
          id: m.id,
          title: m.title,
          organizerEmployeeId: m.organizerEmployeeId,
          organizerName: this.name(m.organizerEmployeeId),
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          status: m.status,
          myRole: m.organizerEmployeeId === params.viewerId ? 'organizer' : 'invitee',
          myRsvp: mine?.rsvp ?? null,
          attendeeCount: m.attendees.length,
        };
      });
    return { items, total: matching.length };
  }

  async overlaps(
    _tx: MeetingTx,
    employeeIds: string[],
    startsAt: string,
    endsAt: string,
    excludeId: string | null,
  ): Promise<Overlap[]> {
    const result: Overlap[] = [];
    for (const m of this.meetings) {
      if (m.status !== 'scheduled' || m.id === excludeId) continue;
      if (!this.overlapsWindow(m, startsAt, endsAt)) continue;
      const people = [m.organizerEmployeeId, ...m.attendees.map((a) => a.employeeId)];
      for (const employeeId of employeeIds) {
        if (people.includes(employeeId)) result.push({ employeeId, meetingId: m.id });
      }
    }
    return result;
  }

  async dueReminders(now: Date, withinMinutes: number) {
    const limit = now.getTime() + withinMinutes * 60 * 1000;
    return this.meetings
      .filter(
        (m) =>
          m.status === 'scheduled' &&
          !m.reminderSent &&
          Date.parse(m.startsAt) > now.getTime() &&
          Date.parse(m.startsAt) <= limit,
      )
      .map((m) => ({
        meetingId: m.id,
        startsAt: m.startsAt,
        recipientEmployeeIds: m.attendees
          .filter((a) => a.rsvp !== 'declined')
          .map((a) => a.employeeId),
      }));
  }

  async claimReminder(_tx: MeetingTx, meetingId: string): Promise<boolean> {
    const found = this.meetings.find((m) => m.id === meetingId);
    if (!found || found.reminderSent) return false;
    found.reminderSent = true;
    return true;
  }
}
