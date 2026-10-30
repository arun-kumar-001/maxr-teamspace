import { z } from 'zod';

const AUTH_MAX_PASSWORD = 128;

export const loginSchema = z
  .object({
    email: z.string().trim().min(3).max(255),
    // Capped so a huge body cannot be used to burn hashing time.
    password: z.string().min(1).max(AUTH_MAX_PASSWORD),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(AUTH_MAX_PASSWORD),
    newPassword: z.string().min(1).max(AUTH_MAX_PASSWORD),
  })
  .strict();

const role = z.enum(['admin', 'hr_manager', 'team_lead', 'staff']);

export const profileSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role,
    roles: z.array(role),
    permissions: z.array(z.string()),
  })
  .meta({ id: 'AuthProfile' });

export const sessionResponseSchema = z
  .object({
    data: z.object({
      user: profileSchema,
      /** Send this in the `X-CSRF-Token` header on every POST, PUT and DELETE. */
      csrfToken: z.string(),
    }),
  })
  .meta({ id: 'AuthSession' });
