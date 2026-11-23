import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  applyForLeaveSchema,
  leaveCalendarEntrySchema,
  leaveCalendarQuerySchema,
  leaveRequestIdParamsSchema,
  leaveRequestSchema,
  listLeaveRequestsQuerySchema,
  listMyLeaveRequestsQuerySchema,
} from './requests.schemas';

const tags = ['Leave'];
const one = z.object({ data: leaveRequestSchema });
registerRoute({
  method: 'get',
  path: '/leave-requests/approval-route',
  tags,
  summary:
    'List the approver roles the signed-in employee may select for this leave request. HR leave is restricted to Admin; Team Lead requires an assigned active Team Lead.',
  permission: 'leave.apply',
  success: {
    status: 200,
    description: 'Available approver roles, without creating a request',
    schema: z.object({
      data: z.object({ approverRoles: z.array(z.enum(['hr_manager', 'team_lead', 'admin'])) }),
    }),
  },
});
const page = z.object({
  data: z.array(leaveRequestSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

registerRoute({
  method: 'post',
  path: '/leave-requests',
  tags,
  summary:
    'Apply for leave with an explicitly selected approverRole: hr_manager, team_lead or admin. HR leave must go to Admin. Team Lead requires an assigned active Team Lead; unavailable selections are rejected. Working days exclude holidays and must fit the available balance including pending requests.',
  permission: 'leave.apply',
  idempotent: true,
  body: applyForLeaveSchema,
  extraResponses: {
    409: 'The dates overlap another leave request of yours that is applied, pending or approved',
    422: 'Unknown or inactive type, a half day not allowed or not a single date, spans two years, starts too far in the past, no working days, no balance, or not enough balance',
  },
  success: { status: 201, description: 'The request, pending', schema: one },
});

registerRoute({
  method: 'get',
  path: '/leave-requests/me',
  tags,
  summary: 'Your own leave requests, latest first; filter by status, type or a date range',
  permission: 'leave.read_own',
  query: listMyLeaveRequestsQuerySchema,
  success: { status: 200, description: 'A page of your requests', schema: page },
});

registerRoute({
  method: 'get',
  path: '/leave-requests',
  tags,
  summary:
    'Leave requests in your scope (Team Lead: direct reports, HR Manager and Admin: everyone), latest first',
  permission: 'leave.list',
  query: listLeaveRequestsQuerySchema,
  success: { status: 200, description: 'A page of requests', schema: page },
});

registerRoute({
  method: 'get',
  path: '/leave-requests/{id}',
  tags,
  summary: 'One request: yours, or one inside the approvers’ scope. 404 otherwise',
  permission: 'leave.read_own',
  params: leaveRequestIdParamsSchema,
  success: { status: 200, description: 'The request', schema: one },
});

registerRoute({
  method: 'get',
  path: '/leave-requests/calendar',
  tags,
  summary:
    'Who is away between two dates (at most 62 days): pending and approved leave of your direct reports (Team Lead) or everyone (HR Manager, Admin). Reasons are not included',
  permission: 'leave.list',
  query: leaveCalendarQuerySchema,
  success: {
    status: 200,
    description: 'Leave touching the range, earliest first (at most 2000 entries)',
    schema: z.object({ data: z.array(leaveCalendarEntrySchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/leave-requests/{id}/cancel',
  tags,
  summary:
    'Cancel a leave request. You can cancel your own while it is pending, and approved leave only before it starts; HR Manager and Admin can cancel approved or pending leave of others at any time. Approved leave gives its days back to the balance',
  permission: 'leave.cancel',
  params: leaveRequestIdParamsSchema,
  extraResponses: {
    403: 'Your approved leave has already started; ask HR',
    404: 'Not your request, or not in your scope',
    409: 'The request is rejected or already cancelled',
  },
  success: { status: 200, description: 'The cancelled request', schema: one },
});
