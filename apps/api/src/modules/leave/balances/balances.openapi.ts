import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  accrualBodySchema,
  accrualResultSchema,
  employeeLeaveBalanceSchema,
  leaveBalanceSchema,
  listBalancesQuerySchema,
  myBalancesQuerySchema,
} from './balances.schemas';

const tags = ['Leave'];

registerRoute({
  method: 'get',
  path: '/leave-balances/me',
  tags,
  summary: 'Your own leave balances for a year (default: the current company year)',
  permission: 'leave.read_own',
  query: myBalancesQuerySchema,
  success: {
    status: 200,
    description: 'One balance per leave type',
    schema: z.object({ data: z.array(leaveBalanceSchema) }),
  },
});

registerRoute({
  method: 'get',
  path: '/leave-balances',
  tags,
  summary:
    'Leave balances in your scope for a year (Team Lead: direct reports, HR Manager and Admin: everyone)',
  permission: 'leave_balances.list',
  query: listBalancesQuerySchema,
  success: {
    status: 200,
    description: 'A page of balances',
    schema: z.object({
      data: z.array(employeeLeaveBalanceSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/leave-balances/accrual',
  tags,
  summary:
    'Create the missing balances of a year for everyone (HR Manager, Admin): pro-rata for joiners, carry-forward from the year before. Repeating it creates nothing new',
  permission: 'leave_balances.accrue',
  body: accrualBodySchema,
  extraResponses: { 422: 'The year has not started yet' },
  success: {
    status: 200,
    description: 'How many balances were created',
    schema: z.object({ data: accrualResultSchema }),
  },
});
