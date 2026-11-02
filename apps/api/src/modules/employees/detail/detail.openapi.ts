import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import { employeeDetailSchema, updateEmployeeSchema } from './detail.schemas';

const tags = ['Employees'];
const one = z.object({ data: employeeDetailSchema });

registerRoute({
  method: 'get',
  path: '/employees/{id}',
  tags,
  summary:
    'One employee. Admin and HR see the company, a Team Lead their direct reports, Staff only themselves. Login information (`account`) is shown to Admin and HR only',
  permission: 'employees.read',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'The employee, with the `version` to send back on edit',
    schema: one,
  },
});

registerRoute({
  method: 'put',
  path: '/employees/{id}',
  tags,
  summary:
    'Change employee fields (Admin, HR Manager). Send only the fields to change and the `version` you read. HR cannot change `employeeCode` or `email`; status, manager and role have their own flows',
  permission: 'employees.update',
  params: idParamSchema,
  body: updateEmployeeSchema,
  extraResponses: {
    403: 'An HR Manager tried to change the employee code or the email',
    409: 'The version is stale (someone else changed the employee), or the code or email is taken',
    422: 'The employee is deactivated, or the department or designation is missing, inactive or does not match',
  },
  success: {
    status: 200,
    description: 'The employee after the change (unchanged when nothing differs)',
    schema: one,
  },
});
