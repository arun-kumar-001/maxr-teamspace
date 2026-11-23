import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

const year = z.coerce.number().int().min(2000).max(2100);

export const myBalancesQuerySchema = z.object({ year: year.optional() }).strict();

export const listBalancesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    employeeId: z.string().uuid().optional(),
    year: year.optional(),
  })
  .strict();

export const accrualBodySchema = z.object({ year: z.number().int().min(2000).max(2100) }).strict();

const balanceFields = {
  leaveTypeId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  year: z.number().int(),
  allotted: z.number(),
  carriedForward: z.number(),
  used: z.number(),
  remaining: z.number(),
};

export const leaveBalanceSchema = z.object(balanceFields).meta({ id: 'LeaveBalance' });

export const employeeLeaveBalanceSchema = z
  .object({ ...balanceFields, employeeId: z.string().uuid(), employeeName: z.string() })
  .meta({ id: 'EmployeeLeaveBalance' });

export const accrualResultSchema = z
  .object({ year: z.number().int(), created: z.number().int() })
  .meta({ id: 'LeaveAccrualResult' });

export type MyBalancesQuery = z.infer<typeof myBalancesQuerySchema>;
export type ListBalancesQuery = z.infer<typeof listBalancesQuerySchema>;
