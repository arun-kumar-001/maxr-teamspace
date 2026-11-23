import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { assertEditable, checkInvitees, checkWindow } from './meetings.rules';
import { IMeetingsRepository } from './meetings.repository';
import type {
  ListMeetingsQuery,
  ScheduleMeetingInput,
  UpdateMeetingInput,
} from './meetings.schemas';
import { Meeting, MeetingSummary, MeetingTx, MeetingValues, Overlap, Rsvp } from './meetings.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export interface MeetingCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

/** How long before a meeting the invitees are reminded (D-18). */
export const REMINDER_LEAD_MINUTES = 15;

export interface MeetingWithOverlaps {
  meeting: Meeting;
  /** Other meetings that overlap this one for the organizer or an invitee. A warning, not a block. */
  overlaps: Overlap[];
}

export class MeetingsService {
  constructor(
    private readonly repository: IMeetingsRepository,
    private readonly platform: Deps,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async ensureInviteesActive(tx: MeetingTx, inviteeIds: string[]): Promise<void> {
    const active = await this.repository.activeEmployees(tx, inviteeIds);
    if (inviteeIds.some((id) => !active.has(id))) {
      throw unprocessable('Every invitee must be an active employee');
    }
  }

  /** Visible to the organizer and the invitees; anyone else gets the 404 of a missing meeting. */
  async get(id: string, viewerId: string): Promise<Meeting> {
    const found = await this.repository.find(id, viewerId);
    if (!found) throw notFound('Meeting not found');
    return found;
  }

  async list(
    query: ListMeetingsQuery,
    viewerId: string,
  ): Promise<PaginatedResponse<MeetingSummary>> {
    const { items, total } = await this.repository.list({
      viewerId,
      from: query.from,
      to: query.to,
      ...toOffsetLimit(query),
    });
    return buildPage(items, total, query);
  }

  /** Scheduling needs `meetings.schedule`; the route checks it. The organizer is the caller. */
  async schedule(input: ScheduleMeetingInput, caller: MeetingCaller): Promise<MeetingWithOverlaps> {
    checkWindow(input.startsAt, input.endsAt, this.clock());
    const inviteeIds = checkInvitees(input.inviteeIds, caller.employeeId);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    const id = await this.repository.transaction(async (tx) => {
      await this.ensureInviteesActive(tx, [caller.employeeId, ...inviteeIds]);
      const values: MeetingValues = {
        title: input.title,
        agenda: input.agenda ?? null,
        minutes: null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      };
      const meetingId = await this.repository.insert(tx, caller.employeeId, values, inviteeIds);
      await audit.record(
        {
          action: 'meeting.schedule',
          outcome: 'success',
          entityType: 'meeting',
          entityId: meetingId,
          // The title and agenda can name people or clients: the trail records the count only.
          metadata: { inviteeCount: inviteeIds.length, startsAt: input.startsAt },
        },
        { transaction: tx },
      );
      if (inviteeIds.length > 0) {
        events.add({
          type: 'meetings.invited',
          payload: { meetingId, inviteeEmployeeIds: inviteeIds },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
      }
      return meetingId;
    });
    await events.flush(this.platform.events);
    return this.withOverlaps(id, caller.employeeId);
  }

  private async withOverlaps(id: string, viewerId: string): Promise<MeetingWithOverlaps> {
    const meeting = await this.get(id, viewerId);
    const people = [meeting.organizerEmployeeId, ...meeting.attendees.map((a) => a.employeeId)];
    const overlaps = await this.repository.transaction((tx) =>
      this.repository.overlaps(tx, people, meeting.startsAt, meeting.endsAt, id),
    );
    return { meeting, overlaps };
  }

  /** Only the organizer changes a meeting, and a cancelled one not at all. Send the version read. */
  async update(
    id: string,
    input: UpdateMeetingInput,
    caller: MeetingCaller,
  ): Promise<MeetingWithOverlaps> {
    await this.get(id, caller.employeeId);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.lockForUpdate(tx, id);
      if (!current) throw notFound('Meeting not found');
      if (current.organizerEmployeeId !== caller.employeeId) {
        throw forbidden('Only the organizer can change this meeting');
      }
      if (current.version !== input.version) {
        throw conflict('This meeting was changed by someone else; reload it and try again');
      }
      assertEditable(current.status);
      const next: MeetingValues = {
        title: input.title ?? current.title,
        agenda: input.agenda === undefined ? current.agenda : input.agenda,
        minutes: input.minutes === undefined ? current.minutes : input.minutes,
        startsAt: input.startsAt ?? current.startsAt,
        endsAt: input.endsAt ?? current.endsAt,
      };
      const timeChanged = next.startsAt !== current.startsAt || next.endsAt !== current.endsAt;
      if (timeChanged) checkWindow(next.startsAt, next.endsAt, this.clock());
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of ['title', 'agenda', 'startsAt', 'endsAt'] as const) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      const minutesChanged = next.minutes !== current.minutes;
      const invitees =
        input.inviteeIds === undefined ? null : checkInvitees(input.inviteeIds, caller.employeeId);
      if (invitees) await this.ensureInviteesActive(tx, invitees);
      const sameInvitees =
        invitees === null ||
        (invitees.length === current.attendees.length &&
          invitees.every((id2) => current.attendees.some((a) => a.employeeId === id2)));
      if (Object.keys(changes).length === 0 && !minutesChanged && sameInvitees) return;

      await this.repository.update(tx, id, next);
      let added: string[] = [];
      let removed: string[] = [];
      if (invitees) {
        ({ added, removed } = await this.repository.replaceAttendees(tx, id, invitees));
      }
      // Titles, agendas and minutes are free text: the trail records that they changed, not what they say.
      const trail: Record<string, { from: unknown; to: unknown }> = { ...changes };
      if (trail.title) trail.title = { from: '[changed]', to: '[changed]' };
      if (trail.agenda) trail.agenda = { from: '[changed]', to: '[changed]' };
      if (minutesChanged) trail.minutes = { from: '[changed]', to: '[changed]' };
      if (removed.length > 0) trail.inviteesRemoved = { from: removed.length, to: 0 };
      if (added.length > 0) trail.inviteesAdded = { from: 0, to: added.length };
      await audit.record(
        {
          action: 'meeting.update',
          outcome: 'success',
          entityType: 'meeting',
          entityId: id,
          changes: trail,
        },
        { transaction: tx },
      );
      if (added.length > 0) {
        events.add({
          type: 'meetings.invited',
          payload: { meetingId: id, inviteeEmployeeIds: added },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
      }
    });
    await events.flush(this.platform.events);
    return this.withOverlaps(id, caller.employeeId);
  }

  async cancel(id: string, caller: MeetingCaller): Promise<Meeting> {
    await this.get(id, caller.employeeId);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.lockForUpdate(tx, id);
      if (!current) throw notFound('Meeting not found');
      if (current.organizerEmployeeId !== caller.employeeId) {
        throw forbidden('Only the organizer can cancel this meeting');
      }
      if (current.status === 'cancelled') throw conflict('This meeting is already cancelled');
      await this.repository.cancel(tx, id);
      await audit.record(
        {
          action: 'meeting.cancel',
          outcome: 'success',
          entityType: 'meeting',
          entityId: id,
          changes: { status: { from: 'scheduled', to: 'cancelled' } },
        },
        { transaction: tx },
      );
      const invitees = current.attendees.map((a) => a.employeeId);
      if (invitees.length > 0) {
        events.add({
          type: 'meetings.cancelled',
          payload: { meetingId: id, inviteeEmployeeIds: invitees },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
      }
    });
    await events.flush(this.platform.events);
    return this.get(id, caller.employeeId);
  }

  /** An invitee answers. The organizer and anyone not invited get a 404 here. */
  async rsvp(id: string, response: Rsvp, caller: MeetingCaller): Promise<Meeting> {
    const meeting = await this.get(id, caller.employeeId);
    const invited = meeting.attendees.some((a) => a.employeeId === caller.employeeId);
    if (!invited) throw notFound('Meeting not found');
    if (meeting.status !== 'scheduled') throw unprocessable('A cancelled meeting takes no answers');
    await this.repository.transaction(async (tx) => {
      await this.repository.setRsvp(tx, id, caller.employeeId, response);
    });
    return this.get(id, caller.employeeId);
  }

  /** Reminds the invitees of meetings starting within 15 minutes, once per meeting (D-18). */
  async sendReminders(now: Date): Promise<number> {
    let sent = 0;
    for (const due of await this.repository.dueReminders(now, REMINDER_LEAD_MINUTES)) {
      const events = new EventCollector();
      const claimed = await this.repository.transaction((tx) =>
        this.repository.claimReminder(tx, due.meetingId),
      );
      if (!claimed) continue;
      if (due.recipientEmployeeIds.length > 0) {
        events.add({
          type: 'meetings.reminder_due',
          payload: { meetingId: due.meetingId, inviteeEmployeeIds: due.recipientEmployeeIds },
        });
      }
      await events.flush(this.platform.events);
      sent += 1;
    }
    return sent;
  }
}
