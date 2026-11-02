import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  createLeavePolicySchema,
  leavePolicyIdParamsSchema,
  leavePolicySchema,
  updateLeavePolicySchema,
} from './policies.schemas';

const tags = ['Leave'];
const one = z.object({ data: leavePolicySchema });

registerRoute({
  method: 'get',
  path: '/leave-policies',
  tags,
  summary: 'Leave types with their policies (every signed-in role)',
  permission: 'leave_policies.read',
  success: {
    status: 200,
    description: 'All leave types',
    schema: z.object({ data: z.array(leavePolicySchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/leave-policies',
  tags,
  summary:
    'Add a leave type with its policy (HR Manager, Admin). Run the yearly accrual afterwards to create balances for existing employees',
  permission: 'leave_policies.manage',
  idempotent: true,
  body: createLeavePolicySchema,
  extraResponses: { 409: 'The code or the name is already taken' },
  success: { status: 201, description: 'The new leave type', schema: one },
});

registerRoute({
  method: 'put',
  path: '/leave-policies/{id}',
  tags,
  summary:
    'Change a policy (HR Manager, Admin). Send the version you read; balances that already exist are not changed',
  permission: 'leave_policies.manage',
  params: leavePolicyIdParamsSchema,
  body: updateLeavePolicySchema,
  extraResponses: {
    409: 'Someone changed it since you read it, or the name is taken',
    422: 'A type without a balance cannot have annual days or carry forward',
  },
  success: { status: 200, description: 'The policy after the change', schema: one },
});
