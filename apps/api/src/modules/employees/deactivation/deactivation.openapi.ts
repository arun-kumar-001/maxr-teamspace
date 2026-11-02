import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import { deactivateBodySchema, deactivationResultSchema } from './deactivation.schemas';

registerRoute({
  method: 'post',
  path: '/employees/{id}/deactivate',
  tags: ['Employees'],
  summary:
    'Deactivate an employee now (Admin only): the employee and the sign-in account are switched off and every session ends. Nothing is deleted. Repeating the call is a 200 that changes nothing',
  permission: 'employees.deactivate',
  params: idParamSchema,
  body: deactivateBodySchema,
  extraResponses: {
    422: 'You cannot deactivate yourself, and the last active Admin cannot be deactivated',
  },
  success: {
    status: 200,
    description:
      'The deactivated employee, the number of sessions ended, and the direct reports who now have no active manager',
    schema: z.object({ data: deactivationResultSchema }),
  },
});
