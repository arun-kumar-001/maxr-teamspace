import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  listOnboardingQuerySchema,
  setPasswordSchema,
  verifyItemSchema,
} from './onboarding.schemas';

const onboardingItemSchema = z.object({
  id: z.string().uuid(),
  checklistId: z.string().uuid(),
  step: z.enum(['hr', 'system', 'it_admin', 'employee']),
  itemKey: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isVerified: z.boolean(),
  verifiedAt: z.coerce.date().nullable(),
  verifiedBy: z.string().nullable(),
  notes: z.string().nullable(),
});

const onboardingSummarySchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  departmentId: z.string().uuid(),
  departmentName: z.string(),
  designationId: z.string().uuid(),
  designationTitle: z.string(),
  managerId: z.string().uuid().nullable(),
  joiningDate: z.string(),
  employeeStatus: z.string(),
  userActive: z.boolean(),
  status: z.enum(['in_progress', 'completed']),
  currentStep: z.enum(['hr', 'system', 'it_admin', 'employee', 'completed']),
  completedAt: z.coerce.date().nullable(),
  totalItems: z.number(),
  verifiedItems: z.number(),
});

const onboardingDetailSchema = onboardingSummarySchema.extend({
  items: z.array(onboardingItemSchema),
});

registerRoute({
  method: 'get',
  path: '/onboarding',
  tags: ['Onboarding'],
  summary: 'List onboarding checklists with stage and progress (Admin, HR Manager, Team Lead)',
  permission: 'onboarding.list',
  query: listOnboardingQuerySchema,
  success: {
    status: 200,
    description: 'Paginated list of onboarding checklists',
    schema: z.object({
      data: z.array(onboardingSummarySchema),
      total: z.number(),
    }),
  },
});

registerRoute({
  method: 'get',
  path: '/onboarding/me',
  tags: ['Onboarding'],
  summary: 'Get onboarding checklist for the logged-in employee',
  permission: 'onboarding.read_own',
  success: {
    status: 200,
    description: 'Own onboarding checklist detail',
    schema: z.object({ data: onboardingDetailSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/onboarding/{id}',
  tags: ['Onboarding'],
  summary: 'Get onboarding checklist detail by employee ID',
  permission: 'onboarding.read',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Onboarding checklist detail with items',
    schema: z.object({ data: onboardingDetailSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/onboarding/{id}/items/{itemKey}/verify',
  tags: ['Onboarding'],
  summary: 'Verify a specific onboarding checklist item',
  permission: 'onboarding.verify_hr',
  body: verifyItemSchema,
  success: {
    status: 200,
    description: 'Updated onboarding checklist',
    schema: z.object({ data: onboardingDetailSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/onboarding/{id}/activate',
  tags: ['Onboarding'],
  summary: 'Activate employee account once all checklist items are verified',
  permission: 'onboarding.activate',
  params: idParamSchema,
  extraResponses: {
    422: 'Unverified checklist items remain; account cannot be activated',
  },
  success: {
    status: 200,
    description: 'Activated employee checklist detail',
    schema: z.object({ data: onboardingDetailSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/onboarding/set-password',
  tags: ['Onboarding'],
  summary: 'Claim account and set initial password using 72h single-use token',
  access: 'Public',
  body: setPasswordSchema,
  success: {
    status: 200,
    description: 'Password set success confirmation',
    schema: z.object({
      data: z.object({
        success: z.boolean(),
        employeeId: z.string(),
      }),
    }),
  },
});
