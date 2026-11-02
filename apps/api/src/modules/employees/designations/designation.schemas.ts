import { booleanQuery, listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const designationSchema = z.object({
  id: z.string().uuid(),
  departmentId: z.string().uuid(),
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  level: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDesignationSchema = z
  .object({
    departmentId: z.string().uuid(),
    title: z.string().trim().min(1).max(255),
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, {
        message: 'Designation code must contain only letters, numbers, underscores, or hyphens',
      }),
    level: z.number().int().min(1).default(1),
  })
  .strict();

export const updateDesignationSchema = z
  .object({
    departmentId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, {
        message: 'Designation code must contain only letters, numbers, underscores, or hyphens',
      })
      .optional(),
    level: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listDesignationsQuerySchema = listQuerySchema({
  departmentId: z.string().uuid().optional(),
  isActive: booleanQuery.optional(),
});

export const DESIGNATION_SORTABLE_FIELDS = {
  title: 'title',
  code: 'code',
  level: 'level',
  createdAt: 'createdAt',
} as const;
