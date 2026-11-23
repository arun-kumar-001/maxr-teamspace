import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  listMeetingsQuerySchema,
  meetingIdParamsSchema,
  meetingSchema,
  rsvpSchema,
  scheduleMeetingSchema,
  updateMeetingSchema,
} from './meetings.schemas';

const tags = ['Meetings'];
const notVisible = {
  404: 'You are neither the organizer nor invited (or the meeting does not exist)',
};
const overlapped = z.object({
  employeeId: z.string().uuid(),
  meetingId: z.string().uuid(),
});
const withOverlaps = z.object({
  meeting: meetingSchema,
  overlaps: z.array(overlapped),
});

registerRoute({
  method: 'get',
  path: '/meetings',
  tags,
  summary:
    'Meetings you organise or are invited to that overlap a window (at most 62 days), earliest first',
  permission: 'meetings.read_own',
  query: listMeetingsQuerySchema,
  success: {
    status: 200,
    description: 'A page of meetings',
    schema: z.object({
      data: z.array(z.object({}).passthrough()),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/meetings',
  tags,
  summary:
    'Schedule a meeting (Team Lead, HR Manager, Admin). Up to 100 invitees; overlaps with the organizer’s or an invitee’s other meetings are returned as warnings, not refused',
  permission: 'meetings.schedule',
  body: scheduleMeetingSchema,
  extraResponses: {
    422: 'Times out of order, longer than 24 hours, in the past, too many invitees, or an invitee is not active',
  },
  success: {
    status: 201,
    description: 'The meeting and its overlaps',
    schema: z.object({ data: withOverlaps }),
  },
});

registerRoute({
  method: 'get',
  path: '/meetings/{id}',
  tags,
  summary: 'One meeting with its invitees and their answers, for the organizer and the invitees',
  permission: 'meetings.read_own',
  params: meetingIdParamsSchema,
  extraResponses: notVisible,
  success: { status: 200, description: 'The meeting', schema: z.object({ data: meetingSchema }) },
});

registerRoute({
  method: 'put',
  path: '/meetings/{id}',
  tags,
  summary:
    'Change a meeting (the organizer). Send the `version` you read. Adding invitees invites them; removing one drops them. Minutes are plain text up to 20,000 characters',
  permission: 'meetings.schedule',
  params: meetingIdParamsSchema,
  body: updateMeetingSchema,
  extraResponses: {
    ...notVisible,
    403: 'You are not the organizer',
    409: 'Someone changed it since you read it, or it is cancelled',
    422: 'Times out of order, too long, in the past, too many invitees, or an invitee is not active',
  },
  success: {
    status: 200,
    description: 'The meeting and its overlaps',
    schema: z.object({ data: withOverlaps }),
  },
});

registerRoute({
  method: 'post',
  path: '/meetings/{id}/cancel',
  tags,
  summary: 'Cancel a meeting (the organizer). The invitees are told',
  permission: 'meetings.schedule',
  params: meetingIdParamsSchema,
  extraResponses: {
    ...notVisible,
    403: 'You are not the organizer',
    409: 'Already cancelled',
  },
  success: {
    status: 200,
    description: 'The cancelled meeting',
    schema: z.object({ data: meetingSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/meetings/{id}/rsvp',
  tags,
  summary: 'Answer an invitation: accepted, declined or tentative. Only invitees may answer',
  permission: 'meetings.rsvp',
  params: meetingIdParamsSchema,
  body: rsvpSchema,
  extraResponses: {
    ...notVisible,
    422: 'The meeting is cancelled',
  },
  success: {
    status: 200,
    description: 'The meeting with your answer',
    schema: z.object({ data: meetingSchema }),
  },
});
