import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import { employeeDetailSchema } from '../detail/detail.schemas';
import { updateProfileSchema } from './profile.schemas';

const tags = ['Employees'];
const one = z.object({ data: employeeDetailSchema });

registerRoute({
  method: 'get',
  path: '/employees/me',
  tags,
  summary: "The signed-in employee's own profile, with the `version` to send back on edit",
  permission: 'profile.read',
  success: { status: 200, description: "The caller's own employee record", schema: one },
});

registerRoute({
  method: 'put',
  path: '/employees/me',
  tags,
  summary:
    'Change your own phone number. Nothing else can be changed here: any other field (role, manager, code, status, department, email, name) is a 400',
  permission: 'profile.update',
  body: updateProfileSchema,
  extraResponses: { 409: 'The version is stale: the record was changed since you read it' },
  success: {
    status: 200,
    description: 'The profile after the change (unchanged when the phone is already this value)',
    schema: one,
  },
});
