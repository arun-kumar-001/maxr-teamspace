import { listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

const moneyField = z.number().finite().min(0).max(100_000_000);
// Accept standard 8-4-4-4-12 PostgreSQL UUIDs (including deterministic local dev seed IDs).
const uuidInput = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid UUID',
  );

export const leaveBalancesSnapshotSchema = z
  .object({
    sl: z.number().finite().min(0).max(365).default(0),
    el: z.number().finite().min(0).max(365).default(0),
    cl: z.number().finite().min(0).max(365).default(0),
    fl: z.number().finite().min(0).max(365).default(0),
    lc: z.number().finite().min(0).max(365).default(0),
  })
  .strict();

export const createPayslipSchema = z
  .object({
    employeeId: uuidInput,
    payMonth: z.number().int().min(1).max(12),
    payYear: z.number().int().min(2000).max(2100),
    status: z.enum(['draft', 'published']).optional(),
    designation: z.string().trim().max(150).optional(),
    uan: z.string().trim().max(32).optional(),
    pan: z.string().trim().max(20).optional(),
    bankName: z.string().trim().max(120).optional(),
    accountNumber: z.string().trim().max(40).optional(),
    beneficiaryId: z.string().trim().max(60).optional(),
    workLocation: z.string().trim().max(120).optional(),
    baseBranch: z.string().trim().max(120).optional(),
    subLocation: z.string().trim().max(120).optional(),
    daysPaid: z.number().finite().min(0).max(31).optional(),
    leaveBalances: leaveBalancesSnapshotSchema.partial().optional(),
    basicSalary: moneyField,
    basicArrears: moneyField.optional(),
    hra: moneyField.optional(),
    hraArrears: moneyField.optional(),
    performancePay: moneyField.optional(),
    performanceArrears: moneyField.optional(),
    variableAllowance: moneyField.optional(),
    variableArrears: moneyField.optional(),
    providentFund: moneyField.optional(),
    incomeTax: moneyField.optional(),
    professionalTax: moneyField.optional(),
    otherDeductionDesc: z.string().trim().max(150).optional(),
    otherDeductionAmount: moneyField.optional(),
    retiralPf: moneyField.optional(),
    retiralGratuity: moneyField.optional(),
    annualIncome: moneyField.optional(),
    taxDeductions: moneyField.optional(),
    netTaxIncome: moneyField.optional(),
    totalTaxPayable: moneyField.optional(),
    taxDeductedTillNow: moneyField.optional(),
    balanceTax: moneyField.optional(),
  })
  .strict();

export const updatePayslipSchema = createPayslipSchema
  .omit({
    employeeId: true,
    payMonth: true,
    payYear: true,
  })
  .partial();

export const listPayslipsQuerySchema = listQuerySchema({
  employeeId: uuidInput.optional(),
  payMonth: z.coerce.number().int().min(1).max(12).optional(),
  payYear: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

export const payslipIdParamsSchema = z
  .object({
    id: uuidInput,
  })
  .strict();

export type CreatePayslipInput = z.infer<typeof createPayslipSchema>;
export type UpdatePayslipInput = z.infer<typeof updatePayslipSchema>;
export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
