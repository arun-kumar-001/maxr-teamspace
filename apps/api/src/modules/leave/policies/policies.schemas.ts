import { z } from 'zod';

/** Days come in whole or half steps, as the database CHECKs require. */
const days = z
  .number()
  .min(0)
  .max(366)
  .refine((value) => Number.isInteger(value * 2), 'Use whole or half days');
const backdate = z.number().int().min(0).max(30);

export const leavePolicyIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createLeavePolicySchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Letters, digits and underscores, starting with a letter'),
    name: z.string().trim().min(1).max(100),
    hasBalance: z.boolean().default(true),
    annualDays: days.default(0),
    carryForwardMax: days.default(0),
    allowHalfDay: z.boolean().default(true),
    maxBackdateDays: backdate.default(0),
  })
  .strict()
  .refine((v) => v.hasBalance || (v.annualDays === 0 && v.carryForwardMax === 0), {
    message: 'A leave type without a balance has no annual days or carry forward',
    path: ['hasBalance'],
  });

export const updateLeavePolicySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    annualDays: days.optional(),
    carryForwardMax: days.optional(),
    allowHalfDay: z.boolean().optional(),
    maxBackdateDays: backdate.optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const leavePolicySchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    hasBalance: z.boolean(),
    isActive: z.boolean(),
    annualDays: z.number(),
    carryForwardMax: z.number(),
    allowHalfDay: z.boolean(),
    maxBackdateDays: z.number().int(),
    version: z.number().int(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'LeavePolicy' });

export type CreateLeavePolicyInput = z.infer<typeof createLeavePolicySchema>;
export type UpdateLeavePolicyInput = z.infer<typeof updateLeavePolicySchema>;
