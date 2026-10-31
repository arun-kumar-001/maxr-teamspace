import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

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

const status = z.enum(['active', 'archived']);
const name = z.string().trim().min(1).max(150);
const description = z.string().trim().min(1).max(1000);

export const projectIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const projectMemberParamsSchema = z
  .object({ id: z.string().uuid(), employeeId: z.string().uuid() })
  .strict();

export const createProjectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_-]{1,19}$/, 'Letters, digits, - and _, starting with a letter'),
    name,
    description: description.optional(),
    startDate: calendarDate.optional(),
    endDate: calendarDate.optional(),
    /** Admin only: a Team Lead always owns what they create. */
    ownerEmployeeId: z.string().uuid().optional(),
    memberIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .strict()
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'The end date must be on or after the start date',
    path: ['endDate'],
  });

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    status: status.optional(),
    startDate: calendarDate.nullable().optional(),
    endDate: calendarDate.nullable().optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const addMemberSchema = z.object({ employeeId: z.string().uuid() }).strict();

export const listProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    status: status.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const projectFields = {
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status,
  ownerEmployeeId: z.string().uuid(),
  ownerName: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  version: z.number().int(),
  memberCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const projectSchema = z.object(projectFields).meta({ id: 'Project' });

export const projectDetailSchema = z
  .object({
    ...projectFields,
    members: z.array(
      z.object({ employeeId: z.string().uuid(), name: z.string(), addedAt: z.string().datetime() }),
    ),
  })
  .meta({ id: 'ProjectDetail' });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
