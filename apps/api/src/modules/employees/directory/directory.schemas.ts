import { z } from 'zod';

export const EMPLOYEE_SORTABLE_FIELDS = {
  name: 'name',
  employeeCode: 'employeeCode',
  joiningDate: 'joiningDate',
  createdAt: 'createdAt',
} as const;

export type EmployeeSortField = keyof typeof EMPLOYEE_SORTABLE_FIELDS;

export const employeeDirectoryQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(['name', 'employeeCode', 'joiningDate', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().trim().max(100).optional(),
    departmentId: z.string().uuid().optional(),
    designationId: z.string().uuid().optional(),
    status: z.enum(['active', 'pending', 'deactivated']).optional(),
    managerId: z.string().uuid().optional(),
  })
  .strict();
