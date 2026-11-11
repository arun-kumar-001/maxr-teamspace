import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  addMemberSchema,
  createMilestoneSchema,
  createProjectSchema,
  createProjectUpdateSchema,
  listProjectsQuerySchema,
  milestoneSchema,
  projectDetailSchema,
  projectDocumentParamsSchema,
  projectDocumentSchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  projectMilestoneParamsSchema,
  projectSchema,
  projectUpdateResponseSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  uploadDocumentQuerySchema,
} from './projects.schemas';

const tags = ['Projects'];
const one = z.object({ data: projectDetailSchema });
const notVisible = { 404: 'The project does not exist, or you neither own it nor belong to it' };
const ownerOnly = { 403: 'Only the project owner or an Admin can change it' };

registerRoute({
  method: 'get',
  path: '/projects',
  tags,
  summary: 'The projects you own or belong to (an Admin sees all), with summary overview counts',
  permission: 'projects.read',
  query: listProjectsQuerySchema,
  success: {
    status: 200,
    description: 'A page of projects with overview counts',
    schema: z.object({
      data: z.array(projectSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
      summary: z.object({
        totalAssigned: z.number().int(),
        inProgress: z.number().int(),
        completed: z.number().int(),
        upcoming: z.number().int(),
        onHold: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/projects',
  tags,
  summary:
    'Create a project (Team Lead, Admin). A Team Lead owns it; an Admin may name another Team Lead or Admin as owner.',
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
  summary: 'One project with its members, milestones, updates, and documents',
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
    'Change a project, or archive and reactivate it with `status`. Send the `version` you read.',
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

registerRoute({
  method: 'post',
  path: '/projects/{id}/milestones',
  tags,
  summary: 'Create a project milestone (project owner or Admin)',
  permission: 'projects.manage',
  params: projectIdParamsSchema,
  body: createMilestoneSchema,
  extraResponses: { ...notVisible, ...ownerOnly, 422: 'Project archived or invalid dates' },
  success: {
    status: 201,
    description: 'The created milestone',
    schema: z.object({ data: milestoneSchema }),
  },
});

registerRoute({
  method: 'put',
  path: '/projects/{id}/milestones/{milestoneId}',
  tags,
  summary: 'Update a project milestone (project owner or Admin)',
  permission: 'projects.manage',
  params: projectMilestoneParamsSchema,
  body: updateMilestoneSchema,
  extraResponses: { ...notVisible, ...ownerOnly, 422: 'Project archived or invalid dates' },
  success: {
    status: 200,
    description: 'The updated milestone',
    schema: z.object({ data: milestoneSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/projects/{id}/updates',
  tags,
  summary: 'Post a progress update, comment, or manager update on a visible project',
  permission: 'projects.read',
  params: projectIdParamsSchema,
  body: createProjectUpdateSchema,
  extraResponses: {
    ...notVisible,
    403: 'Only the project owner or an Admin can post manager updates',
    422: 'The project is archived',
  },
  success: {
    status: 201,
    description: 'The posted project update',
    schema: z.object({ data: projectUpdateResponseSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/projects/{id}/documents',
  tags,
  summary: 'Upload a project document (PDF, PNG, or JPEG up to 10 MB)',
  permission: 'projects.read',
  params: projectIdParamsSchema,
  query: uploadDocumentQuerySchema,
  extraResponses: {
    ...notVisible,
    409: 'This document is already attached to the project',
    422: 'The project is archived or file validation failed',
  },
  success: {
    status: 201,
    description: 'The uploaded document metadata',
    schema: z.object({ data: projectDocumentSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/projects/{id}/documents/{documentId}/download-link',
  tags,
  summary: 'Get a short-lived signed download URL for a project document',
  permission: 'projects.read',
  params: projectDocumentParamsSchema,
  extraResponses: notVisible,
  success: {
    status: 200,
    description: 'Signed download link',
    schema: z.object({ data: z.object({ url: z.string(), expiresAt: z.string() }) }),
  },
});

registerRoute({
  method: 'delete',
  path: '/projects/{id}/documents/{documentId}',
  tags,
  summary: 'Remove a project document (uploader, project owner, or Admin)',
  permission: 'projects.read',
  params: projectDocumentParamsSchema,
  extraResponses: {
    ...notVisible,
    403: 'Only the uploader, project manager, or an Admin can remove it',
    422: 'The project is archived',
  },
  success: {
    status: 200,
    description: 'Removed',
    schema: z.object({ data: z.object({ removed: z.boolean() }) }),
  },
});
