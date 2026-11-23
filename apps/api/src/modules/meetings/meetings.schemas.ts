import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';
import { MAX_INVITEES, MAX_MINUTES_CHARS } from './meetings.types';

const instant = z.string().datetime({ offset: true });
const title = z.string().trim().min(1).max(200);
const agenda = z.string().trim().min(1).max(5000);
const minutes = z.string().max(MAX_MINUTES_CHARS);
const invitees = z.array(z.string().uuid()).max(MAX_INVITEES);

export const meetingIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const scheduleMeetingSchema = z
  .object({
    title,
    agenda: agenda.optional(),
    startsAt: instant,
    endsAt: instant,
    inviteeIds: invitees.default([]),
  })
  .strict();

export const updateMeetingSchema = z
  .object({
    title: title.optional(),
    agenda: agenda.nullable().optional(),
    startsAt: instant.optional(),
    endsAt: instant.optional(),
    minutes: minutes.nullable().optional(),
    inviteeIds: invitees.optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const rsvpSchema = z
  .object({ response: z.enum(['accepted', 'declined', 'tentative']) })
  .strict();

export const listMeetingsQuerySchema = z
  .object({
    /** The window in instants: the caller sends the company-local day boundaries. */
    from: instant,
    to: instant,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  })
  .strict()
  .refine((v) => Date.parse(v.to) > Date.parse(v.from), {
    message: 'The end must be after the start',
    path: ['to'],
  })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 62, {
    message: 'Ask for at most 62 days at a time',
    path: ['to'],
  });

const attendeeSchema = z.object({
  employeeId: z.string().uuid(),
  name: z.string(),
  rsvp: z.enum(['pending', 'accepted', 'declined', 'tentative']),
  respondedAt: z.string().datetime().nullable(),
});

export const meetingSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    agenda: z.string().nullable(),
    minutes: z.string().nullable(),
    organizerEmployeeId: z.string().uuid(),
    organizerName: z.string(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    status: z.enum(['scheduled', 'cancelled']),
    version: z.number().int(),
    attendees: z.array(attendeeSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'Meeting' });

export type ScheduleMeetingInput = z.infer<typeof scheduleMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
