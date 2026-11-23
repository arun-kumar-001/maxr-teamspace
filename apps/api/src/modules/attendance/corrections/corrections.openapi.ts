import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  correctionIdParamsSchema,
  correctionSchema,
  listCorrectionsQuerySchema,
  requestCorrectionSchema,
} from './corrections.schemas';

const tags = ['Attendance'];
const one = z.object({ data: correctionSchema });

registerRoute({
  method: 'post',
  path: '/attendance/corrections',
  tags,
  summary:
    'Ask to correct the times of one of your own attendance records (up to 30 days old, one pending request per record). Your manager decides, or HR when you have none, through /approvals',
  permission: 'attendance.request_correction',
  idempotent: true,
  body: requestCorrectionSchema,
  extraResponses: {
    404: 'The record does not exist or is not yours',
    409: 'The record already has a pending correction, or the times overlap another session',
    422: 'The record is too old, the check-in is not on its work date, the check-out is not after the check-in, the session is over 24 hours, or a time is in the future',
  },
  success: { status: 201, description: 'The pending correction', schema: one },
});

registerRoute({
  method: 'get',
  path: '/attendance/corrections',
  tags,
  summary: 'Your own correction requests, newest first',
  permission: 'attendance.read_own',
  query: listCorrectionsQuerySchema,
  success: {
    status: 200,
    description: 'A page of your corrections',
    schema: z.object({
      data: z.array(correctionSchema),
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
  method: 'get',
  path: '/attendance/corrections/{id}',
  tags,
  summary:
    'One correction: yours, or one inside the approvers’ scope (Team Lead: direct reports, HR and Admin: everyone). 404 otherwise',
  permission: 'attendance.read_own',
  params: correctionIdParamsSchema,
  success: { status: 200, description: 'The correction', schema: one },
});

registerRoute({
  method: 'post',
  path: '/attendance/corrections/{id}/cancel',
  tags,
  summary: 'Withdraw your own correction while it is still pending',
  permission: 'attendance.request_correction',
  params: correctionIdParamsSchema,
  extraResponses: { 409: 'The correction is no longer pending' },
  success: { status: 200, description: 'The cancelled correction', schema: one },
});
