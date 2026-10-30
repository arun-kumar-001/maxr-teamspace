import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  templateSchema,
  updateTemplateSchema,
} from './template.schemas';

const Template = templateSchema.meta({ id: 'Template' });
const tags = ['Template (sample module)'];
const one = z.object({ data: Template });

registerRoute({
  method: 'get',
  path: '/templates',
  tags,
  summary: 'List templates (paginated)',
  permission: 'employees.list',
  query: listTemplatesQuerySchema,
  success: {
    status: 200,
    description: 'A page of templates',
    schema: z.object({
      data: z.array(Template),
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
  path: '/templates/{id}',
  tags,
  summary: 'Get one template',
  permission: 'employees.read',
  params: idParamSchema,
  success: { status: 200, description: 'The template', schema: one },
});

registerRoute({
  method: 'post',
  path: '/templates',
  tags,
  summary: 'Create a template (idempotent)',
  permission: 'employees.create',
  idempotent: true,
  body: createTemplateSchema,
  success: { status: 201, description: 'Created', schema: one },
});

registerRoute({
  method: 'put',
  path: '/templates/{id}',
  tags,
  summary: 'Update a template',
  permission: 'employees.update',
  params: idParamSchema,
  body: updateTemplateSchema,
  success: { status: 200, description: 'Updated', schema: one },
});

registerRoute({
  method: 'post',
  path: '/templates/{id}/deactivate',
  tags,
  summary: 'Deactivate a template',
  permission: 'employees.deactivate',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Deactivated',
    schema: z.object({ data: z.object({ id: z.string().uuid(), isActive: z.literal(false) }) }),
  },
});
