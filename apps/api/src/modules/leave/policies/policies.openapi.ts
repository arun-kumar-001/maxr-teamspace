import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  createLeavePolicySchema,
  leaveApprovalSettingsSchema,
  leavePolicyIdParamsSchema,
  leavePolicySchema,
  updateLeavePolicySchema,
} from './policies.schemas';

const tags = ['Leave'];
const one = z.object({ data: leavePolicySchema });

registerRoute({
  method: 'get',
  path: '/leave-policies/approval-settings',
  tags,
  summary: 'Read the company leave approver setting',
  permission: 'leave_policies.manage',
  success: {
    status: 200,
    description: 'The current approval role and version',
    schema: z.object({ data: leaveApprovalSettingsSchema }),
  },
});
registerRoute({
  method: 'put',
  path: '/leave-policies/approval-settings',
  tags,
  summary: 'Choose HR or Team Lead for new leave requests. HR leave goes to Admin',
  permission: 'leave_policies.manage',
  body: leaveApprovalSettingsSchema,
  extraResponses: { 409: 'The settings version is stale' },
  success: {
    status: 200,
    description: 'The saved approval role and version',
    schema: z.object({ data: leaveApprovalSettingsSchema }),
  },
});

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
    'Add a leave type with its policy (HR Manager, Admin). Balances are created for every active employee straight away',
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

registerRoute({
  method: 'delete',
  path: '/leave-policies/{id}',
  tags,
  summary:
    'Delete a leave type nobody has used (HR Manager, Admin). One with leave history can only be deactivated',
  permission: 'leave_policies.manage',
  params: leavePolicyIdParamsSchema,
  extraResponses: { 409: 'The leave type has leave requests or used days; deactivate it instead' },
  success: { status: 204, description: 'The leave type was deleted' },
});
