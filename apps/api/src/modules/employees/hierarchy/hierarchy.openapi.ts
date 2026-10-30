import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  changeManagerSchema,
  managerChangeSchema,
  orgListQuerySchema,
  orgNodeSchema,
} from './hierarchy.schemas';

const tags = ['Employees'];
const meta = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

registerRoute({
  method: 'get',
  path: '/employees/org-roots',
  tags,
  summary:
    'The top of the org chart: employees with no manager (deactivated ones only with status=deactivated). Admin and HR see the company; a Team Lead sees none, since their team reports to them',
  permission: 'employees.list',
  query: orgListQuerySchema,
  success: {
    status: 200,
    description: 'A page of org nodes, each with its direct report count',
    schema: z.object({ data: z.array(orgNodeSchema), meta }),
  },
});

registerRoute({
  method: 'get',
  path: '/employees/{id}/direct-reports',
  tags,
  summary:
    'The direct reports of one employee, to open the org chart one level at a time. A Team Lead can ask for themselves',
  permission: 'employees.list',
  params: idParamSchema,
  query: orgListQuerySchema,
  success: {
    status: 200,
    description: 'A page of org nodes, each with its direct report count',
    schema: z.object({ data: z.array(orgNodeSchema), meta }),
  },
});

registerRoute({
  method: 'put',
  path: '/employees/{id}/manager',
  tags,
  summary:
    "Assign, change or remove (managerId null) an employee's manager (Admin, HR Manager). Refuses a manager who is the employee or reports to them (a loop), or who is not active",
  permission: 'employees.update',
  params: idParamSchema,
  body: changeManagerSchema,
  extraResponses: {
    409: 'The version is stale: someone else changed the employee',
    422: 'The employee is deactivated, or the manager is missing, inactive, the employee themselves, or would create a loop',
  },
  success: {
    status: 200,
    description:
      "The employee's manager after the change (unchanged when it is already this manager)",
    schema: z.object({ data: managerChangeSchema }),
  },
});
