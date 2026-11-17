import { describe, expect, it } from 'vitest';
import { renderPayslipPdf } from './payslips.pdf';
import { buildPayslipFilename, type PayslipRecord } from './payslips.types';

const pageCount = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

function makeRecord(overrides: Partial<PayslipRecord> = {}): PayslipRecord {
  return {
    id: '81000000-0000-0000-0000-000000000001',
    employeeId: '50000000-0000-0000-0000-000000000004',
    employeeCode: 'EMP-0004',
    employeeName: 'Ananya Sen',
    departmentName: 'Engineering',
    payMonth: 10,
    payYear: 2026,
    periodLabel: 'October 2026',
    status: 'published',
    designation: 'Software Engineer',
    uan: '101482930411',
    pan: 'BSKPA8492M',
    bankName: 'HDFC Bank Ltd',
    accountNumber: 'XXXXXX4821',
    beneficiaryId: 'BEN-EMP0004',
    workLocation: 'Chennai - Tidal Park',
    baseBranch: 'Chennai HQ',
    subLocation: 'Chennai - Siruseri',
    daysPaid: 31,
    leaveBalances: { sl: 4, el: 12, cl: 5, fl: 2, lc: 0 },
    basicSalary: 45000,
    basicArrears: 0,
    hra: 18000,
    hraArrears: 0,
    performancePay: 12000,
    performanceArrears: 0,
    variableAllowance: 16800,
    variableArrears: 0,
    totalCurrentEarnings: 91800,
    totalArrearsEarnings: 0,
    totalEarnings: 91800,
    providentFund: 5400,
    incomeTax: 1200,
    professionalTax: 200,
    otherDeductionDesc: '',
    otherDeductionAmount: 0,
    totalDeductions: 6800,
    netPay: 85000,
    retiralPf: 5400,
    retiralGratuity: 2165,
    annualIncome: 1101600,
    taxDeductions: 150000,
    netTaxIncome: 951600,
    totalTaxPayable: 46800,
    taxDeductedTillNow: 27300,
    balanceTax: 19500,
    publishedAt: '2026-10-31T10:00:00Z',
    publishedBy: '60000000-0000-0000-0000-000000000002',
    createdAt: '2026-10-31T09:00:00Z',
    updatedAt: '2026-10-31T10:00:00Z',
    ...overrides,
  };
}

describe('Payslip PDF renderer (exact A4 template)', () => {
  it('generates a real single-page A4 PDF with dynamic employee values', async () => {
    const buffer = await renderPayslipPdf(makeRecord());

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buffer)).toBe(1);
    expect(buffer.length).toBeGreaterThan(3000);
    // Ensure template never embeds sample/reference person names
    expect(buffer.toString('utf8')).not.toContain('Venkat Bala');
  }, 30_000);

  it('builds standardized payslip download filename', () => {
    expect(buildPayslipFilename({ payMonth: 10, payYear: 2026, employeeCode: 'EMP-0004' })).toBe(
      'MAXR_Payslip_October_2026_EMP-0004.pdf',
    );
  });
});
