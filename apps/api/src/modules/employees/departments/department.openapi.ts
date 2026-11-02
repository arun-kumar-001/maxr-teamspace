import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  createDepartmentSchema,
  departmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.schemas';

const Department = departmentSchema.meta({ id: 'Department' });
const tags = ['Departments'];
const one = z.object({ data: Department });

registerRoute({
  method: 'get',
  path: '/departments',
  tags,
  summary: 'List departments (paginated)',
  permission: 'departments.list',
  query: listDepartmentsQuerySchema,
  success: {
    status: 200,
    description: 'A page of departments',
    schema: z.object({
      data: z.array(Department),
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
  path: '/departments/{id}',
  tags,
  summary: 'Get one department by ID',
  permission: 'departments.list',
  params: idParamSchema,
  success: { status: 200, description: 'The department details', schema: one },
});

registerRoute({
  method: 'post',
  path: '/departments',
  tags,
  summary: 'Create a department (idempotent)',
  permission: 'departments.create',
  idempotent: true,
  body: createDepartmentSchema,
  success: { status: 201, description: 'Department created successfully', schema: one },
});

registerRoute({
  method: 'put',
  path: '/departments/{id}',
  tags,
  summary: 'Update a department',
  permission: 'departments.update',
  params: idParamSchema,
  body: updateDepartmentSchema,
  success: { status: 200, description: 'Department updated successfully', schema: one },
});

registerRoute({
  method: 'post',
  path: '/departments/{id}/deactivate',
  tags,
  summary: 'Soft-deactivate a department',
  permission: 'departments.deactivate',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Department deactivated successfully',
    schema: z.object({ data: z.object({ id: z.string().uuid(), isActive: z.literal(false) }) }),
  },
});
