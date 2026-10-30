import { z } from 'zod';

/** The body is empty on purpose: there is nothing to choose, and no field can change anything else. */
export const deactivateBodySchema = z.object({}).strict();

export const deactivationResultSchema = z
  .object({
    id: z.string().uuid(),
    status: z.literal('deactivated'),
    deactivatedAt: z.string().datetime(),
    version: z.number().int(),
    alreadyDeactivated: z.boolean(),
    sessionsRevoked: z.number().int(),
    directReports: z.array(
      z.object({ id: z.string().uuid(), employeeCode: z.string(), name: z.string() }),
    ),
  })
  .meta({ id: 'DeactivationResult' });
