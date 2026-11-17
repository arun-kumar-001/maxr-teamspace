import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  createUserSchema,
  permissionSummarySchema,
  replaceRolesSchema,
  roleSummarySchema,
  updateUserStatusSchema,
  userAccountSchema,
  userIdParamsSchema,
  userQueryObject,
} from './users.schemas';

const tags = ['Users and roles'];

registerRoute({
  method: 'get',
  path: '/users',
  tags,
  summary: 'List sign-in accounts with their roles (search, role and status filters)',
  permission: 'users.list',
  query: userQueryObject,
  success: {
    status: 200,
    description: 'A page of accounts',
    schema: z.object({
      data: z.array(userAccountSchema),
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
  path: '/users/{id}',
  tags,
  summary: 'One sign-in account with its roles',
  permission: 'users.read',
  params: userIdParamsSchema,
  success: {
    status: 200,
    description: 'The account',
    schema: z.object({ data: userAccountSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/users',
  tags,
  summary: 'Create a user account directly with assigned roles (Admin; audited)',
  permission: 'users.create',
  body: createUserSchema,
  extraResponses: { 409: 'A user with this email already exists' },
  success: {
    status: 201,
    description: 'The created account (includes temporaryPassword when auto-generated)',
    schema: z.object({
      data: userAccountSchema,
      meta: z.object({ temporaryPassword: z.string() }).optional(),
    }),
  },
});

registerRoute({
  method: 'put',
  path: '/users/{id}/roles',
  tags,
  summary:
    'Set the complete role list of an account (Admin; audited). 422 when it would remove the last active Admin',
  permission: 'users.assign_role',
  params: userIdParamsSchema,
  body: replaceRolesSchema,
  extraResponses: { 422: 'The last active Admin cannot lose the Admin role' },
  success: {
    status: 200,
    description: 'The account after the change (unchanged when the roles were already these)',
    schema: z.object({ data: userAccountSchema }),
  },
});

registerRoute({
  method: 'put',
  path: '/users/{id}/status',
  tags,
  summary:
    'Activate or deactivate a user account (Admin; audited). Revokes active sessions on deactivation.',
  permission: 'users.deactivate',
  params: userIdParamsSchema,
  body: updateUserStatusSchema,
  extraResponses: { 422: 'Cannot deactivate yourself or the last active Admin' },
  success: {
    status: 200,
    description: 'The updated account',
    schema: z.object({ data: userAccountSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/roles',
  tags,
  summary: 'The four system roles with the number of active accounts holding each (Admin)',
  permission: 'roles.list',
  success: {
    status: 200,
    description: 'Roles',
    schema: z.object({ data: z.array(roleSummarySchema) }),
  },
});

registerRoute({
  method: 'get',
  path: '/permissions',
  tags,
  summary: 'The permission catalog with the record scope each role holds (Admin; read only)',
  permission: 'permissions.list',
  success: {
    status: 200,
    description: 'Permissions',
    schema: z.object({ data: z.array(permissionSummarySchema) }),
  },
});
