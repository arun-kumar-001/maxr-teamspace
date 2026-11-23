export type Rsvp = 'pending' | 'accepted' | 'declined' | 'tentative';
export type MeetingStatus = 'scheduled' | 'cancelled';

export const MAX_INVITEES = 100;
export const MAX_MEETING_MINUTES = 24 * 60;
export const MAX_MINUTES_CHARS = 20_000;
export const MAX_AGENDA_CHARS = 5_000;

export const RSVP_LABELS: Record<Rsvp, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  tentative: 'Tentative',
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
};

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

export interface MeetingWithOverlaps {
  meeting: Meeting;
  overlaps: Overlap[];
}

export interface ScheduleMeetingInput {
  title: string;
  agenda?: string;
  startsAt: string;
  endsAt: string;
  inviteeIds?: string[];
}

export interface UpdateMeetingInput {
  title?: string;
  agenda?: string | null;
  startsAt?: string;
  endsAt?: string;
  minutes?: string | null;
  inviteeIds?: string[];
  version: number;
}

export interface ListMeetingsQuery {
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
}

export interface ListMeetingsResponse {
  data: MeetingSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
