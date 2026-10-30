import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import { employeeDirectoryQuerySchema } from './directory.schemas';

export const employeeDirectoryItemSchema = z
  .object({
    id: z.string().uuid(),
    employeeCode: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
    department: z.object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string(),
    }),
    designation: z.object({
      id: z.string().uuid(),
      title: z.string(),
      code: z.string(),
      level: z.number().int(),
    }),
    manager: z
      .object({
        id: z.string().uuid(),
        firstName: z.string(),
        lastName: z.string(),
        employeeCode: z.string(),
      })
      .nullable(),
    status: z.enum(['active', 'pending', 'deactivated']),
    joiningDate: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'EmployeeDirectoryItem' });

const Employee = employeeDirectoryItemSchema;
const tags = ['Employees'];

registerRoute({
  method: 'get',
  path: '/employees',
  tags,
  summary: 'List employee directory records (paginated, scoped)',
  permission: 'employees.list',
  query: employeeDirectoryQuerySchema,
  success: {
    status: 200,
    description: 'A page of employee directory records',
    schema: z.object({
      data: z.array(Employee),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});
