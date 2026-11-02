import { conflict, unprocessable } from '../../http/errors';
import { MAX_INVITEES, MAX_MEETING_MINUTES } from './meetings.types';

const MINUTE_MS = 60 * 1000;

/** The time window of a meeting: it must start in the future, end after it starts, and last at most a day. */
export function checkWindow(startsAt: string, endsAt: string, now: Date): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!(end > start)) throw unprocessable('The meeting must end after it starts');
  if ((end - start) / MINUTE_MS > MAX_MEETING_MINUTES) {
    throw unprocessable('A meeting can last at most 24 hours');
  }
  if (start <= now.getTime()) throw unprocessable('A meeting must start in the future');
}

/** Invitees are unique, at most the limit, and never the organizer (D-18). */
export function checkInvitees(inviteeIds: string[], organizerId: string): string[] {
  const unique = [...new Set(inviteeIds)];
  if (unique.length > MAX_INVITEES) {
    throw unprocessable(`A meeting can have at most ${MAX_INVITEES} invitees`);
  }
  return unique.filter((id) => id !== organizerId);
}

/** Only the organizer changes a meeting; a cancelled one is final. */
export function assertEditable(status: string): void {
  if (status !== 'scheduled') throw conflict('A cancelled meeting cannot be changed');
}
