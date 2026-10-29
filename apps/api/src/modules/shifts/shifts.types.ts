import { z } from 'zod';
import {
  assignEmployeeShiftSchema,
  attendancePolicySchema,
  createShiftSchema,
  employeeShiftSchema,
  listShiftsQuerySchema,
  shiftSchema,
  updateAttendancePolicySchema,
  updateShiftSchema,
} from './shifts.schemas';

export type Shift = z.infer<typeof shiftSchema>;
export type CreateShiftDto = z.infer<typeof createShiftSchema>;
export type UpdateShiftDto = z.infer<typeof updateShiftSchema>;
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;

export type AttendancePolicy = z.infer<typeof attendancePolicySchema>;
export type UpdateAttendancePolicyDto = z.infer<typeof updateAttendancePolicySchema>;

export type AssignEmployeeShiftDto = z.infer<typeof assignEmployeeShiftSchema>;
export type EmployeeShift = z.infer<typeof employeeShiftSchema>;
