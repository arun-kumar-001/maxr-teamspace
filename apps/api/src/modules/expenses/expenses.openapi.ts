import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  createExpenseCategorySchema,
  createExpenseClaimSchema,
  expenseStatusSchema,
  listExpenseClaimsQuerySchema,
  updateExpenseCategorySchema,
} from './expenses.schemas';

const expenseCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const expenseClaimSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeName: z.string().optional(),
  employeeCode: z.string().optional(),
  categoryId: z.string().uuid(),
  categoryName: z.string().optional(),
  amountPaise: z.number().int(),
  currency: z.literal('INR'),
  expenseDate: z.string(),
  description: z.string(),
  receiptStorageKey: z.string().nullable(),
  receiptFilename: z.string().nullable(),
  receiptMimeType: z.string().nullable(),
  receiptFileSize: z.number().nullable(),
  status: expenseStatusSchema,
  rejectionReason: z.string().nullable(),
  reimbursedAt: z.string().nullable(),
  reimbursedByEmployeeId: z.string().nullable(),
  reimbursedByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

registerRoute({
  method: 'get',
  path: '/expense-categories',
  tags: ['Expenses'],
  summary: 'List active expense categories',
  permission: 'expenses.read_categories',
  success: {
    status: 200,
    description: 'Active expense categories',
    schema: z.object({ data: z.array(expenseCategorySchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-categories',
  tags: ['Expenses'],
  summary: 'Create expense category',
  permission: 'expenses.manage_categories',
  body: createExpenseCategorySchema,
  success: {
    status: 201,
    description: 'Created category',
    schema: z.object({ data: expenseCategorySchema }),
  },
});

registerRoute({
  method: 'put',
  path: '/expense-categories/{id}',
  tags: ['Expenses'],
  summary: 'Update expense category',
  permission: 'expenses.manage_categories',
  params: idParamSchema,
  body: updateExpenseCategorySchema,
  success: {
    status: 200,
    description: 'Updated category',
    schema: z.object({ data: expenseCategorySchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/mine',
  tags: ['Expenses'],
  summary: 'List own submitted expense claims',
  permission: 'expenses.submit',
  query: listExpenseClaimsQuerySchema,
  success: {
    status: 200,
    description: 'Paginated list of own expense claims',
    schema: z.object({
      data: z.array(expenseClaimSchema),
      meta: z.object({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        pageCount: z.number(),
      }),
    }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims',
  tags: ['Expenses'],
  summary: 'List expense claims within caller scope',
  permission: 'expenses.list',
  query: listExpenseClaimsQuerySchema,
  success: {
    status: 200,
    description: 'Paginated list of scoped expense claims',
    schema: z.object({
      data: z.array(expenseClaimSchema),
      meta: z.object({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        pageCount: z.number(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims',
  tags: ['Expenses'],
  summary: 'Submit expense claim with optional receipt',
  permission: 'expenses.submit',
  body: createExpenseClaimSchema,
  success: {
    status: 201,
    description: 'Submitted claim',
    schema: z.object({ data: expenseClaimSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/{id}',
  tags: ['Expenses'],
  summary: 'Get expense claim details',
  permission: 'expenses.read',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Expense claim details',
    schema: z.object({ data: expenseClaimSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/cancel',
  tags: ['Expenses'],
  summary: 'Cancel own submitted expense claim',
  permission: 'expenses.cancel',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Cancelled claim',
    schema: z.object({ data: expenseClaimSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/reimburse',
  tags: ['Expenses'],
  summary: 'Mark approved claim as reimbursed',
  permission: 'expenses.reimburse',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Reimbursed claim',
    schema: z.object({ data: expenseClaimSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/{id}/receipt',
  tags: ['Expenses'],
  summary: 'Generate signed download link for claim receipt',
  permission: 'expenses.read',
  params: idParamSchema,
  success: {
    status: 200,
    description: 'Signed download link',
    schema: z.object({
      data: z.object({
        url: z.string(),
        expiresAt: z.string(),
      }),
    }),
  },
});
