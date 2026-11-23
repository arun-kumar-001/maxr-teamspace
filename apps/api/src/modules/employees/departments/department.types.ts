import { z } from 'zod';
import {
  createDepartmentSchema,
  departmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.schemas';

export type DepartmentEntity = z.infer<typeof departmentSchema>;
export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
export type DepartmentListQuery = z.infer<typeof listDepartmentsQuerySchema>;
