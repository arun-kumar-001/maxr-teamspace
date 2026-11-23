import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  createPayslipSchema,
  leaveBalancesSnapshotSchema,
  listPayslipsQuerySchema,
  payslipIdParamsSchema,
  updatePayslipSchema,
} from './payslips.schemas';

const tags = ['Payslips'];

const PayslipSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeCode: z.string(),
    employeeName: z.string(),
    departmentName: z.string().nullable(),
    payMonth: z.number().int(),
    payYear: z.number().int(),
    periodLabel: z.string(),
    status: z.enum(['draft', 'published']),
    designation: z.string(),
    uan: z.string(),
    pan: z.string(),
    bankName: z.string(),
    accountNumber: z.string(),
    beneficiaryId: z.string(),
    workLocation: z.string(),
    baseBranch: z.string(),
    subLocation: z.string(),
    daysPaid: z.number(),
    leaveBalances: leaveBalancesSnapshotSchema,
    basicSalary: z.number(),
    basicArrears: z.number(),
    hra: z.number(),
    hraArrears: z.number(),
    performancePay: z.number(),
    performanceArrears: z.number(),
    variableAllowance: z.number(),
    variableArrears: z.number(),
    totalCurrentEarnings: z.number(),
    totalArrearsEarnings: z.number(),
    totalEarnings: z.number(),
    providentFund: z.number(),
    incomeTax: z.number(),
    professionalTax: z.number(),
    otherDeductionDesc: z.string(),
    otherDeductionAmount: z.number(),
    totalDeductions: z.number(),
    netPay: z.number(),
    retiralPf: z.number(),
    retiralGratuity: z.number(),
    annualIncome: z.number(),
    taxDeductions: z.number(),
    netTaxIncome: z.number(),
    totalTaxPayable: z.number(),
    taxDeductedTillNow: z.number(),
    balanceTax: z.number(),
    publishedAt: z.string().datetime().nullable(),
    publishedBy: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'PayslipRecord' });

const MetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

registerRoute({
  method: 'get',
  path: '/payslips/me',
  tags,
  summary: 'List own published payslips',
  permission: 'payslips.read_own',
  query: listPayslipsQuerySchema,
  success: {
    status: 200,
    description: 'Paginated own published payslips',
    schema: z.object({ data: z.array(PayslipSchema), meta: MetaSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/payslips',
  tags,
  summary: 'List all employee payslips for HR/Admin management',
  permission: 'payslips.read_all',
  query: listPayslipsQuerySchema,
  success: {
    status: 200,
    description: 'Paginated employee payslips',
    schema: z.object({ data: z.array(PayslipSchema), meta: MetaSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/payslips',
  tags,
  summary: 'Create an employee monthly payslip',
  permission: 'payslips.manage',
  body: createPayslipSchema,
  extraResponses: {
    404: 'Employee not found',
    409: 'Payslip already exists for this employee and month/year',
  },
  success: {
    status: 201,
    description: 'Payslip created',
    schema: z.object({ data: PayslipSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/payslips/{id}',
  tags,
  summary: 'Get a payslip record (own published, or any for HR/Admin)',
  permission: 'payslips.read_own',
  params: payslipIdParamsSchema,
  extraResponses: { 404: 'Payslip not found' },
  success: {
    status: 200,
    description: 'Payslip detail',
    schema: z.object({ data: PayslipSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/payslips/{id}/pdf',
  tags,
  summary: 'Download rendered A4 PDF for a payslip',
  permission: 'payslips.read_own',
  params: payslipIdParamsSchema,
  extraResponses: { 404: 'Payslip not found' },
  success: {
    status: 200,
    description: 'Application PDF binary stream',
    schema: z.any(),
  },
});

registerRoute({
  method: 'put',
  path: '/payslips/{id}',
  tags,
  summary: 'Update an employee payslip record',
  permission: 'payslips.manage',
  params: payslipIdParamsSchema,
  body: updatePayslipSchema,
  extraResponses: { 404: 'Payslip not found' },
  success: {
    status: 200,
    description: 'Updated payslip',
    schema: z.object({ data: PayslipSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/payslips/{id}/publish',
  tags,
  summary: 'Publish an employee payslip so the employee can view and download it',
  permission: 'payslips.manage',
  params: payslipIdParamsSchema,
  extraResponses: { 404: 'Payslip not found' },
  success: {
    status: 200,
    description: 'Published payslip',
    schema: z.object({ data: PayslipSchema }),
  },
});
