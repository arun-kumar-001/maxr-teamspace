export type PayslipStatus = 'draft' | 'published';

export interface PayslipLeaveBalances {
  sl: number;
  el: number;
  cl: number;
  fl: number;
  lc: number;
}

export interface PayslipRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  payMonth: number;
  payYear: number;
  periodLabel: string;
  status: PayslipStatus;
  designation: string;
  uan: string;
  pan: string;
  bankName: string;
  accountNumber: string;
  beneficiaryId: string;
  workLocation: string;
  baseBranch: string;
  subLocation: string;
  daysPaid: number;
  leaveBalances: PayslipLeaveBalances;
  basicSalary: number;
  basicArrears: number;
  hra: number;
  hraArrears: number;
  performancePay: number;
  performanceArrears: number;
  variableAllowance: number;
  variableArrears: number;
  totalCurrentEarnings: number;
  totalArrearsEarnings: number;
  totalEarnings: number;
  providentFund: number;
  incomeTax: number;
  professionalTax: number;
  otherDeductionDesc: string;
  otherDeductionAmount: number;
  totalDeductions: number;
  netPay: number;
  retiralPf: number;
  retiralGratuity: number;
  annualIncome: number;
  taxDeductions: number;
  netTaxIncome: number;
  totalTaxPayable: number;
  taxDeductedTillNow: number;
  balanceTax: number;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPayslipDto {
  employeeId: string;
  payMonth: number;
  payYear: number;
  status?: PayslipStatus;
  designation?: string;
  uan?: string;
  pan?: string;
  bankName?: string;
  accountNumber?: string;
  beneficiaryId?: string;
  workLocation?: string;
  baseBranch?: string;
  subLocation?: string;
  daysPaid?: number;
  leaveBalances?: Partial<PayslipLeaveBalances>;
  basicSalary: number;
  basicArrears?: number;
  hra?: number;
  hraArrears?: number;
  performancePay?: number;
  performanceArrears?: number;
  variableAllowance?: number;
  variableArrears?: number;
  providentFund?: number;
  incomeTax?: number;
  professionalTax?: number;
  otherDeductionDesc?: string;
  otherDeductionAmount?: number;
  retiralPf?: number;
  retiralGratuity?: number;
  annualIncome?: number;
  taxDeductions?: number;
  netTaxIncome?: number;
  totalTaxPayable?: number;
  taxDeductedTillNow?: number;
  balanceTax?: number;
}

export interface PayslipCaller {
  actorId: string;
  actorRole: string;
  employeeId?: string;
  requestId?: string;
}

export interface ListPayslipsFilter {
  page: number;
  pageSize: number;
  employeeId?: string;
  payMonth?: number;
  payYear?: number;
  status?: PayslipStatus;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatPayslipMonth(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`;
}

export function formatPayslipPeriod(month: number, year: number): string {
  return `${formatPayslipMonth(month)} ${year}`;
}

export function buildPayslipFilename(
  payslip: Pick<PayslipRecord, 'payMonth' | 'payYear' | 'employeeCode'>,
): string {
  const monthName = formatPayslipMonth(payslip.payMonth).replace(/[^A-Za-z0-9_-]+/g, '_');
  const emp = (payslip.employeeCode || 'EMP').replace(/[^A-Za-z0-9_-]+/g, '_');
  return `MAXR_Payslip_${monthName}_${payslip.payYear}_${emp}.pdf`;
}
