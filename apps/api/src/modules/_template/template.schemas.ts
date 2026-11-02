import { booleanQuery, listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const listTemplatesQuerySchema = listQuerySchema({ isActive: booleanQuery.optional() });

export const SORTABLE_FIELDS = { name: 'name', createdAt: 'createdAt' } as const;
