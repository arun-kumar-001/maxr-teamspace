import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  categoryIdParamsSchema,
  createCategorySchema,
  createClaimSchema,
  expenseIdParamsSchema,
  listClaimsQuerySchema,
  listMyClaimsQuerySchema,
} from './expenses.schemas';

const tags = ['Expenses'];
const notVisible = { 404: 'The claim does not exist or you cannot see it' };

const categorySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});

const receiptSchema = z.object({
  name: z.string(),
  contentType: z.string(),
  size: z.number().int(),
});

const claimSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  categoryId: z.string().uuid(),
  categoryCode: z.string(),
  categoryName: z.string(),
  expenseDate: z.string(),
  amountMinor: z.number().int(),
  currency: z.literal('INR'),
  description: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'reimbursed']),
  receipt: receiptSchema.nullable(),
  approvalId: z.string().uuid().nullable(),
  submittedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  reimbursedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const pageMeta = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

const downloadLinkSchema = z.object({ url: z.string(), expiresAt: z.string() });

registerRoute({
  method: 'get',
  path: '/expense-categories',
  tags,
  summary: 'The active expense categories, by name',
  permission: 'expenses.read_own',
  success: {
    status: 200,
    description: 'The categories',
    schema: z.object({ data: z.array(categorySchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-categories',
  tags,
  summary: 'Add an expense category (HR Manager, Admin)',
  permission: 'expenses.manage_categories',
  body: createCategorySchema,
  idempotent: true,
  extraResponses: { 409: 'A category with this code already exists' },
  success: { status: 201, description: 'The category', schema: z.object({ data: categorySchema }) },
});

registerRoute({
  method: 'post',
  path: '/expense-categories/{id}/deactivate',
  tags,
  summary: 'Deactivate a category: it can no longer be used for new claims; old claims keep it',
  permission: 'expenses.manage_categories',
  params: categoryIdParamsSchema,
  extraResponses: { 404: 'The category does not exist' },
  success: { status: 200, description: 'The category', schema: z.object({ data: categorySchema }) },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/me',
  tags,
  summary: 'Your own expense claims, newest first',
  permission: 'expenses.read_own',
  query: listMyClaimsQuerySchema,
  success: {
    status: 200,
    description: 'A page of claims',
    schema: z.object({ data: z.array(claimSchema), meta: pageMeta }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims',
  tags,
  summary:
    'Expense claims you review, within your role scope (Team Lead: team; HR Manager and Admin: all)',
  permission: 'expenses.list',
  query: listClaimsQuerySchema,
  success: {
    status: 200,
    description: 'A page of claims',
    schema: z.object({ data: z.array(claimSchema), meta: pageMeta }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims',
  tags,
  summary:
    'Create a draft claim. Nothing is routed until it is submitted. The expense date must be within the last 60 days and not in the future; amounts are integer paise',
  permission: 'expenses.submit',
  body: createClaimSchema,
  idempotent: true,
  extraResponses: {
    422: 'Unknown or inactive category, a date outside the claim window, or an amount out of range',
  },
  success: { status: 201, description: 'The draft claim', schema: z.object({ data: claimSchema }) },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/{id}',
  tags,
  summary: 'One claim: your own, or one you review',
  permission: 'expenses.read_own',
  params: expenseIdParamsSchema,
  extraResponses: notVisible,
  success: { status: 200, description: 'The claim', schema: z.object({ data: claimSchema }) },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/receipt',
  tags,
  summary:
    'Attach the receipt to your draft claim: the file is the raw request body. PDF, PNG or JPEG up to 5 MB, checked by content and scanned. Replacing it is not allowed once submitted',
  permission: 'expenses.submit',
  params: expenseIdParamsSchema,
  upload: { contentTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
  extraResponses: {
    ...notVisible,
    400: 'Not an allowed type, the file name or type does not match the content, or the body is empty',
    409: 'The claim is not a draft',
    413: 'The file is larger than 5 MB',
    422: 'Rejected by the virus scan',
  },
  success: {
    status: 201,
    description: 'The claim with its receipt',
    schema: z.object({ data: claimSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/expense-claims/{id}/receipt/download-link',
  tags,
  summary:
    'A short-lived link to the receipt. Only the claimant and the people who review the claim may ask for it',
  permission: 'expenses.read_own',
  params: expenseIdParamsSchema,
  extraResponses: {
    ...notVisible,
    404: 'The claim does not exist, you cannot see it, or it has no receipt',
  },
  success: { status: 200, description: 'The link', schema: z.object({ data: downloadLinkSchema }) },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/submit',
  tags,
  summary:
    'Submit your draft: checks the claim window and the receipt rule (above 200.00 INR), then sends it to your manager and HR',
  permission: 'expenses.submit',
  params: expenseIdParamsSchema,
  extraResponses: {
    ...notVisible,
    409: 'The claim is not a draft',
    422: 'The claim window has passed, or a receipt is required above 200.00 INR',
  },
  success: {
    status: 200,
    description: 'The submitted claim',
    schema: z.object({ data: claimSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/cancel',
  tags,
  summary: 'Withdraw your claim while it is a draft or submitted',
  permission: 'expenses.submit',
  params: expenseIdParamsSchema,
  extraResponses: { ...notVisible, 409: 'The claim is already decided, reimbursed or cancelled' },
  success: {
    status: 200,
    description: 'The cancelled claim',
    schema: z.object({ data: claimSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/expense-claims/{id}/reimburse',
  tags,
  summary:
    'Mark an approved claim as reimbursed (HR Manager, Admin). Nobody reimburses their own claim',
  permission: 'expenses.reimburse',
  params: expenseIdParamsSchema,
  extraResponses: { ...notVisible, 403: 'Your own claim', 409: 'The claim is not approved' },
  success: {
    status: 200,
    description: 'The reimbursed claim',
    schema: z.object({ data: claimSchema }),
  },
});
