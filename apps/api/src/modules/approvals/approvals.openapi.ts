import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  approvalIdParamsSchema,
  approvalQueryObject,
  approvalSchema,
  approveBodySchema,
  rejectBodySchema,
} from './approvals.schemas';

const tags = ['Approvals'];
const one = z.object({ data: approvalSchema });

registerRoute({
  method: 'get',
  path: '/approvals',
  tags,
  summary:
    'The approvals inbox: requests in your scope, oldest first (Staff see their own requests; awaitingMyDecision=true lists what waits for you)',
  permission: 'approvals.list',
  query: approvalQueryObject,
  success: {
    status: 200,
    description: 'A page of approvals',
    schema: z.object({
      data: z.array(approvalSchema),
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
  path: '/approvals/{id}',
  tags,
  summary: 'One approval with its decisions (404 outside your scope)',
  permission: 'approvals.read',
  params: approvalIdParamsSchema,
  success: { status: 200, description: 'The approval', schema: one },
});

registerRoute({
  method: 'post',
  path: '/approvals/{id}/approve',
  tags,
  summary:
    'Approve the current step. The last step applies the decision to the request in the same transaction. Repeating an approval that already stands is a 200 with no change',
  permission: 'approvals.decide',
  params: approvalIdParamsSchema,
  body: approveBodySchema,
  extraResponses: {
    403: 'Your own request, an earlier step you decided, or a step that is not yours',
    409: 'The request was already rejected or cancelled',
  },
  success: { status: 200, description: 'The approval after the decision', schema: one },
});

registerRoute({
  method: 'post',
  path: '/approvals/{id}/reject',
  tags,
  summary: 'Reject at the current step; a comment is required. Ends the request',
  permission: 'approvals.decide',
  params: approvalIdParamsSchema,
  body: rejectBodySchema,
  extraResponses: {
    403: 'Your own request, an earlier step you decided, or a step that is not yours',
    409: 'The request was already approved or cancelled',
  },
  success: { status: 200, description: 'The approval after the decision', schema: one },
});
