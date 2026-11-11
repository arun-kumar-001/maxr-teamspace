import { MAX_PAGE_SIZE, ROLES, type Role } from '@maxr/shared';
import { z } from 'zod';

const roleKey = z.enum(Object.values(ROLES) as [Role, ...Role[]]);

export const userIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Query for `GET /users`. Unknown keys are rejected so a typo cannot silently widen the result. */
export const userQueryObject = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    role: roleKey.optional(),
    isActive: booleanQuery.optional(),
    sortBy: z.enum(['name', 'email', 'createdAt', 'lastLoginAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

/** Body for `PUT /users/{id}/roles`: the complete set of roles the account should have. */
export const replaceRolesSchema = z
  .object({
    roles: z
      .array(roleKey)
      .min(1, 'An account needs at least one role')
      .max(Object.keys(ROLES).length)
      .refine((roles) => new Set(roles).size === roles.length, 'Each role may be listed once'),
  })
  .strict();

/** Body for `POST /users`: directly provisions an account + linked employee record in one transaction. */
export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Valid email address is required').max(255),
    roles: z
      .array(roleKey)
      .min(1, 'An account needs at least one role')
      .max(Object.keys(ROLES).length)
      .refine((roles) => new Set(roles).size === roles.length, 'Each role may be listed once'),
    password: z.string().min(12, 'Password must be at least 12 characters').max(128).optional(),
    isActive: z.boolean().default(true),
    departmentId: z.string().uuid().optional(),
    designationId: z.string().uuid().optional(),
  })
  .strict();

/** Body for `PATCH /users/{id}/status`: activate or deactivate a user account. */
export const updateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const userAccountSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeCode: z.string(),
    name: z.string(),
    email: z.string().email(),
    isActive: z.boolean(),
    roles: z.array(roleKey),
    lastLoginAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'UserAccount' });

export const roleSummarySchema = z
  .object({
    id: z.string().uuid(),
    key: roleKey,
    name: z.string(),
    description: z.string().nullable(),
    activeUsers: z.number().int(),
  })
  .meta({ id: 'Role' });

export const permissionSummarySchema = z
  .object({
    key: z.string(),
    module: z.string(),
    action: z.string(),
    description: z.string(),
    grants: z.record(z.string(), z.enum(['own', 'team', 'hr', 'all'])),
  })
  .meta({ id: 'Permission' });
