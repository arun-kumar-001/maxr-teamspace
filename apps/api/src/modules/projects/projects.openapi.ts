import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  addMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectDetailSchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  projectSchema,
  updateProjectSchema,
} from './projects.schemas';

const tags = ['Projects'];
const one = z.object({ data: projectDetailSchema });
const notVisible = { 404: 'The project does not exist, or you neither own it nor belong to it' };
const ownerOnly = { 403: 'Only the project owner or an Admin can change it' };

registerRoute({
  method: 'get',
  path: '/projects',
  tags,
  summary: 'The projects you own or belong to (an Admin sees all), by status and name',
  permission: 'projects.read',
  query: listProjectsQuerySchema,
  success: {
    status: 200,
    description: 'A page of projects',
    schema: z.object({
      data: z.array(projectSchema),
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
  method: 'post',
  path: '/projects',
  tags,
  summary:
    'Create a project (Team Lead, Admin). A Team Lead owns it; an Admin may name another Team Lead or Admin as owner. Members must be the owner or the owner’s direct reports',
  permission: 'projects.manage',
  idempotent: true,
  body: createProjectSchema,
  extraResponses: {
    403: 'A Team Lead named another owner',
    409: 'The code is already taken',
    422: 'The owner is not an active Team Lead or Admin, or a member is not eligible',
  },
  success: { status: 201, description: 'The new project', schema: one },
});

registerRoute({
  method: 'get',
  path: '/projects/{id}',
  tags,
  summary: 'One project with its members',
  permission: 'projects.read',
  params: projectIdParamsSchema,
  extraResponses: notVisible,
  success: { status: 200, description: 'The project', schema: one },
});

registerRoute({
  method: 'put',
  path: '/projects/{id}',
  tags,
  summary:
    'Change a project, or archive and reactivate it with `status`. Send the `version` you read. An archived project is read-only except for reactivating it',
  permission: 'projects.manage',
  params: projectIdParamsSchema,
  body: updateProjectSchema,
  extraResponses: {
    ...notVisible,
    ...ownerOnly,
    409: 'Someone changed it since you read it',
    422: 'The dates are out of order, or the project is archived',
  },
  success: { status: 200, description: 'The project after the change', schema: one },
});

registerRoute({
  method: 'post',
  path: '/projects/{id}/members',
  tags,
  summary: 'Add a member (the owner’s direct report). Adding someone already in is harmless',
  permission: 'projects.manage',
  params: projectIdParamsSchema,
  body: addMemberSchema,
  extraResponses: {
    ...notVisible,
    ...ownerOnly,
    422: 'Not an active direct report of the owner, or the project is archived',
  },
  success: { status: 200, description: 'The project with its members', schema: one },
});

registerRoute({
  method: 'delete',
  path: '/projects/{id}/members/{employeeId}',
  tags,
  summary: 'Remove a member. The owner cannot be removed',
  permission: 'projects.manage',
  params: projectMemberParamsSchema,
  extraResponses: {
    ...notVisible,
    ...ownerOnly,
    404: 'Not visible, or not a member',
    422: 'The owner, or the project is archived',
  },
  success: { status: 200, description: 'The project with its members', schema: one },
});
