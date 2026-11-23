import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  createDesignationSchema,
  designationSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas';

const Designation = designationSchema.meta({ id: 'Designation' });
const tags = ['Designations'];
const one = z.object({ data: Designation });

registerRoute({
  method: 'get',
  path: '/designations',
  tags,
  summary: 'List designations (paginated)',
  permission: 'designations.list',
  query: listDesignationsQuerySchema,
  success: {
    status: 200,
    description: 'A page of designations',
    schema: z.object({
      data: z.array(Designation),
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
  path: '/designations/{id}',
  tags,
  summary: 'Get one designation by ID',
  permission: 'designations.list',
  params: idParamSchema,
  success: { status: 200, description: 'The designation details', schema: one },
});

registerRoute({
  method: 'post',
  path: '/designations',
  tags,
  summary: 'Create a designation (idempotent)',
  permission: 'designations.create',
  idempotent: true,
  body: createDesignationSchema,
  success: { status: 201, description: 'Designation created successfully', schema: one },
});

registerRoute({
  method: 'put',
  path: '/designations/{id}',
  tags,
  summary: 'Update a designation',
  permission: 'designations.update',
  params: idParamSchema,
  body: updateDesignationSchema,
  success: { status: 200, description: 'Designation updated successfully', schema: one },
});

registerRoute({
  method: 'post',
  path: '/designations/{id}/deactivate',
  tags,
  summary: 'Soft-deactivate a designation',
  permission: 'designations.deactivate',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Designation deactivated successfully',
    schema: z.object({ data: z.object({ id: z.string().uuid(), isActive: z.literal(false) }) }),
  },
});
