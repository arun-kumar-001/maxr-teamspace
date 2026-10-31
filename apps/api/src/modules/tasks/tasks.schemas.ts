import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from './task-rules';

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date')
  .refine(
    (value) => value >= '2000-01-01' && value <= '2100-12-31',
    'Use a year from 2000 to 2100',
  );

const status = z.enum(TASK_STATUSES);
const priority = z.enum(TASK_PRIORITIES);
const title = z.string().trim().min(1).max(200);
const description = z.string().trim().min(1).max(2000);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const taskIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createTaskSchema = z
  .object({
    title,
    description: description.optional(),
    assigneeEmployeeId: z.string().uuid(),
    priority: priority.default('medium'),
    dueDate: calendarDate.optional(),
    projectId: z.string().uuid().optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.nullable().optional(),
    assigneeEmployeeId: z.string().uuid().optional(),
    priority: priority.optional(),
    dueDate: calendarDate.nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const changeStatusSchema = z.object({ status }).strict();

const listFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  status: status.optional(),
  priority: priority.optional(),
  projectId: z.string().uuid().optional(),
  overdue: booleanQuery.optional(),
  dueFrom: calendarDate.optional(),
  dueTo: calendarDate.optional(),
};

export const listMyTasksQuerySchema = z.object(listFields).strict();
export const listTeamTasksQuerySchema = z
  .object({ ...listFields, assigneeEmployeeId: z.string().uuid().optional() })
  .strict();

export const taskSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    projectId: z.string().uuid().nullable(),
    projectName: z.string().nullable(),
    assigneeEmployeeId: z.string().uuid(),
    assigneeName: z.string(),
    assignerEmployeeId: z.string().uuid(),
    assignerName: z.string(),
    status,
    priority,
    dueDate: z.string().nullable(),
    isOverdue: z.boolean(),
    completedAt: z.string().datetime().nullable(),
    version: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'Task' });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListMyTasksQuery = z.infer<typeof listMyTasksQuerySchema>;
export type ListTeamTasksQuery = z.infer<typeof listTeamTasksQuerySchema>;
