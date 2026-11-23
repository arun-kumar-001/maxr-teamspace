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
const priority = z.enum(['high', 'medium', 'low']);
const workflowStatus = z.enum(['not_started', 'in_progress', 'on_hold', 'completed']);
const updateType = z.enum(['manager_update', 'progress_update', 'comment', 'activity']);
const publicUpdateType = z.enum(['manager_update', 'progress_update', 'comment']);
const documentCategory = z.enum(['specification', 'architecture', 'report', 'general']);
const projectSort = z.enum(['name', 'deadline_asc', 'deadline_desc']);

const name = z.string().trim().min(1).max(150);
const description = z.string().trim().min(1).max(1000);
const longText = z.string().trim().min(1).max(2000);
const technologies = z.array(z.string().trim().min(1).max(50)).max(25);
// Accept standard 8-4-4-4-12 PostgreSQL UUIDs (including deterministic local dev seed IDs).
const uuidInput = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid UUID',
  );

export const projectIdParamsSchema = z.object({ id: uuidInput }).strict();
export const projectMemberParamsSchema = z
  .object({ id: uuidInput, employeeId: uuidInput })
  .strict();
export const projectMilestoneParamsSchema = z
  .object({ id: uuidInput, milestoneId: uuidInput })
  .strict();
export const projectDocumentParamsSchema = z
  .object({ id: uuidInput, documentId: uuidInput })
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
    priority: priority.optional(),
    workflowStatus: workflowStatus.optional(),
    progressPercent: z.number().int().min(0).max(100).optional(),
    objectives: longText.optional(),
    scope: longText.optional(),
    technologies: technologies.optional(),
    /** Admin only: a Team Lead always owns what they create. */
    ownerEmployeeId: uuidInput.optional(),
    memberIds: z.array(uuidInput).max(200).optional(),
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
    priority: priority.optional(),
    workflowStatus: workflowStatus.optional(),
    progressPercent: z.number().int().min(0).max(100).optional(),
    objectives: longText.nullable().optional(),
    scope: longText.nullable().optional(),
    technologies: technologies.optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== 'version'), {
    message: 'Send at least one field to change',
  });

export const addMemberSchema = z.object({ employeeId: uuidInput }).strict();

export const createMilestoneSchema = z
  .object({
    title: name,
    description: description.optional(),
    startDate: calendarDate.optional(),
    dueDate: calendarDate.optional(),
    status: workflowStatus.optional(),
    completionPercent: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    message: 'The due date must be on or after the start date',
    path: ['dueDate'],
  });

export const updateMilestoneSchema = z
  .object({
    title: name.optional(),
    description: description.nullable().optional(),
    startDate: calendarDate.nullable().optional(),
    dueDate: calendarDate.nullable().optional(),
    status: workflowStatus.optional(),
    completionPercent: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Send at least one field to change',
  });

export const createProjectUpdateSchema = z
  .object({
    updateType: publicUpdateType.default('comment'),
    content: longText,
    progressPercent: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const uploadDocumentQuerySchema = z
  .object({
    category: documentCategory.default('general'),
  })
  .strict();

export const listProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    status: status.optional(),
    workflowStatus: workflowStatus.optional(),
    priority: priority.optional(),
    sort: projectSort.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const milestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  status: workflowStatus,
  completionPercent: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  authorEmployeeId: z.string().uuid(),
  authorName: z.string(),
  authorRoleLabel: z.string().nullable().optional(),
  updateType,
  content: z.string(),
  progressPercent: z.number().int().nullable(),
  createdAt: z.string().datetime(),
});

export const projectDocumentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  uploadedByEmployeeId: z.string().uuid(),
  uploadedByName: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  category: documentCategory,
  createdAt: z.string().datetime(),
});

const projectFields = {
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status,
  priority,
  workflowStatus,
  progressPercent: z.number().int(),
  objectives: z.string().nullable(),
  scope: z.string().nullable(),
  technologies: z.array(z.string()),
  ownerEmployeeId: z.string().uuid(),
  ownerName: z.string(),
  ownerEmail: z.string().nullable().optional(),
  ownerDesignation: z.string().nullable().optional(),
  ownerDepartment: z.string().nullable().optional(),
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
      z.object({
        employeeId: z.string().uuid(),
        name: z.string(),
        email: z.string().nullable().optional(),
        designation: z.string().nullable().optional(),
        department: z.string().nullable().optional(),
        addedAt: z.string().datetime(),
      }),
    ),
    milestones: z.array(milestoneSchema),
    updates: z.array(projectUpdateResponseSchema),
    documents: z.array(projectDocumentSchema),
  })
  .meta({ id: 'ProjectDetail' });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateProjectUpdateInput = z.infer<typeof createProjectUpdateSchema>;
export type UploadDocumentQuery = z.infer<typeof uploadDocumentQuerySchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
