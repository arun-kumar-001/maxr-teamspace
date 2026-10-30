import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import { createEmployeeSchema, createdEmployeeSchema } from './creation.schemas';

registerRoute({
  method: 'post',
  path: '/employees',
  tags: ['Employees'],
  summary:
    'Create an employee with a sign-in account and role in one step (Admin, HR Manager). The account starts pending and cannot sign in until onboarding activates it',
  permission: 'employees.create',
  idempotent: true,
  body: createEmployeeSchema,
  extraResponses: {
    403: 'An HR Manager tried to create an Admin or HR Manager account',
    409: 'The employee code or the email is already taken',
    422: 'The department, designation or manager is missing, inactive or does not match',
  },
  success: {
    status: 201,
    description: 'The new employee (status pending). No credentials are returned',
    schema: z.object({ data: createdEmployeeSchema }),
  },
});
