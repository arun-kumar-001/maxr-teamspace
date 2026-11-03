import { EXPENSE_STATUS, ExpenseStatus } from '@maxr/shared';
import { z } from 'zod';

export const expenseStatusValues: [ExpenseStatus, ...ExpenseStatus[]] = [
  EXPENSE_STATUS.SUBMITTED,
  EXPENSE_STATUS.APPROVED,
  EXPENSE_STATUS.REJECTED,
  EXPENSE_STATUS.REIMBURSED,
  EXPENSE_STATUS.CANCELLED,
];

export const expenseStatusSchema = z.enum(expenseStatusValues);

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid calendar date');

export const createExpenseClaimSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  amountPaise: z
    .number()
    .int('Amount must be an integer (minor units/paise)')
    .min(1, 'Amount must be greater than zero')
    .max(10_000_000, 'Amount cannot exceed ₹100,000.00 (10,000,000 paise)'),
  expenseDate: dateStringSchema,
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(2000, 'Description too long'),
  receipt: z
    .object({
      filename: z.string().trim().min(1, 'Filename required'),
      declaredType: z.string().trim().min(1, 'MIME type required'),
      base64: z.string().min(1, 'Receipt file content required'),
    })
    .optional(),
});

export const listExpenseClaimsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: expenseStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
});

export const updateExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .optional(),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  isActive: z.boolean().optional(),
});
