import { z } from 'zod';

export const todoIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const createTodoSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be blank').max(255),
    description: z.string().trim().max(2000).nullish(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
      .nullish(),
  })
  .strict();

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be blank').max(255).optional(),
    description: z.string().trim().max(2000).nullish(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
      .nullish(),
    isCompleted: z.boolean().optional(),
  })
  .strict();

export const listTodosQuerySchema = z
  .object({
    completed: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
