import type { Pool, PoolClient } from 'pg';

export type MeetingTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

export type Rsvp = 'pending' | 'accepted' | 'declined' | 'tentative';
export type MeetingStatus = 'scheduled' | 'cancelled';

/** The most invitees one meeting may have (D-18). */
export const MAX_INVITEES = 100;
/** Meetings last at most this many minutes. */
export const MAX_MEETING_MINUTES = 24 * 60;
/** Minutes are plain text up to this length (D-18). */
export const MAX_MINUTES_CHARS = 20_000;

export interface Attendee {
  employeeId: string;
  name: string;
  rsvp: Rsvp;
  respondedAt: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  minutes: string | null;
  organizerEmployeeId: string;
  organizerName: string;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  version: number;
  attendees: Attendee[];
  createdAt: string;
  updatedAt: string;
}

/** A meeting on a calendar, with the viewer's own answer. */
export interface MeetingSummary {
  id: string;
  title: string;
  organizerEmployeeId: string;
  organizerName: string;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  myRole: 'organizer' | 'invitee';
  myRsvp: Rsvp | null;
  attendeeCount: number;
}

export interface Overlap {
  employeeId: string;
  meetingId: string;
}

export interface MeetingValues {
  title: string;
  agenda: string | null;
  startsAt: string;
  endsAt: string;
  minutes: string | null;
}

export interface DueReminder {
  meetingId: string;
  startsAt: string;
  recipientEmployeeIds: string[];
}
