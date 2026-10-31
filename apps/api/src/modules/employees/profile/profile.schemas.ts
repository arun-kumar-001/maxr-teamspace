import { z } from 'zod';
import { phoneSchema } from '../detail/detail.schemas';

/**
 * Body for `PUT /employees/me`. The employee may change their phone number and nothing else; every
 * other key (role, manager, code, status, department, email, name) is rejected, not ignored, so a
 * mass-assignment attempt is a visible 400. New fields are added here on purpose, one at a time.
 */
export const updateProfileSchema = z
  .object({
    version: z.number().int().min(1),
    phone: phoneSchema.nullable(),
  })
  .strict();
