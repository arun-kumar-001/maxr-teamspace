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

export interface PayslipListResponse {
  data: PayslipRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePayslipInput {
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
