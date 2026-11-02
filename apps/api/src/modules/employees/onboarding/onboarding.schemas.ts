import { z } from 'zod';

export const listOnboardingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['in_progress', 'completed']).optional(),
  step: z.enum(['hr', 'system', 'it_admin', 'employee', 'completed']).optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export const verifyItemSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const employeeStepSchema = z.object({
  profileConfirmed: z.boolean(),
  policiesAcknowledged: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
});

export const setPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: z.string().min(12).max(128),
});
