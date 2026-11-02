import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

/**
 * Body for `PUT /employees/{id}/manager`. `managerId: null` removes the manager. Unknown keys are
 * rejected, so nothing else about the employee can be changed through this route.
 */
export const changeManagerSchema = z
  .object({
    version: z.number().int().min(1),
    managerId: z.string().uuid().nullable(),
  })
  .strict();

export const orgListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
    status: z.enum(['active', 'pending', 'deactivated']).optional(),
  })
  .strict();

export const orgNodeSchema = z
  .object({
    id: z.string().uuid(),
    employeeCode: z.string(),
    name: z.string(),
    designation: z.string(),
    status: z.enum(['active', 'pending', 'deactivated']),
    directReportCount: z.number().int(),
  })
  .meta({ id: 'OrgNode' });

export const managerChangeSchema = z
  .object({
    id: z.string().uuid(),
    managerId: z.string().uuid().nullable(),
    manager: z
      .object({ id: z.string().uuid(), employeeCode: z.string(), name: z.string() })
      .nullable(),
    version: z.number().int(),
  })
  .meta({ id: 'ManagerChange' });
