import { booleanQuery, listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const departmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, {
        message: 'Department code must contain only letters, numbers, underscores, or hyphens',
      }),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, {
        message: 'Department code must contain only letters, numbers, underscores, or hyphens',
      })
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listDepartmentsQuerySchema = listQuerySchema({
  isActive: booleanQuery.optional(),
});

export const DEPARTMENT_SORTABLE_FIELDS = {
  name: 'name',
  code: 'code',
  createdAt: 'createdAt',
} as const;
