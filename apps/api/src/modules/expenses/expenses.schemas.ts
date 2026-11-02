import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';
import { EXPENSE_STATUSES, MAX_CLAIM_MINOR } from './expenses.types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD form');
const description = z.string().trim().min(1).max(500);
const categoryCode = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(40);
const categoryName = z.string().trim().min(1).max(100);

export const expenseIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const categoryIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createClaimSchema = z
  .object({
    categoryId: z.string().uuid(),
    expenseDate: isoDate,
    /** Integer paise: 1 to 10,000,000 (100,000.00 INR). Decimals are the client's to convert. */
    amountMinor: z.number().int().min(1).max(MAX_CLAIM_MINOR),
    description: description.nullable().optional(),
  })
  .strict();

const listFilters = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  status: z.enum(EXPENSE_STATUSES).optional(),
};

export const listMyClaimsQuerySchema = z.object(listFilters).strict();

export const listClaimsQuerySchema = z
  .object({ ...listFilters, employeeId: z.string().uuid().optional() })
  .strict();

export const createCategorySchema = z.object({ code: categoryCode, name: categoryName }).strict();

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type ListMyClaimsQuery = z.infer<typeof listMyClaimsQuerySchema>;
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;
