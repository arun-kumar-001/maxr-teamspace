import { booleanQuery, listQuerySchema, uuidString } from '@maxr/shared';
import { z } from 'zod';

export const designationSchema = z.object({
  id: uuidString,
  departmentId: uuidString,
  title: z.string().min(1).max(255),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDesignationSchema = z
  .object({
    departmentId: uuidString,
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const updateDesignationSchema = z
  .object({
    departmentId: uuidString.optional(),
    title: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listDesignationsQuerySchema = listQuerySchema({
  departmentId: uuidString.optional(),
  isActive: booleanQuery.optional(),
});

export const DESIGNATION_SORTABLE_FIELDS = {
  title: 'title',
  createdAt: 'createdAt',
} as const;
