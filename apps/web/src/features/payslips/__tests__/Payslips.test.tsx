// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { PayslipsPage } from '../pages/PayslipsPage';
import type { PayslipRecord } from '../types';

const mockPayslip: PayslipRecord = {
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
  uan: '101458290341',
  pan: 'BNZPS4821K',
  bankName: 'HDFC Bank Ltd.',
  accountNumber: '50100482917304',
  beneficiaryId: 'BEN0048219',
  workLocation: 'Chennai',
  baseBranch: 'Chennai',
  subLocation: 'Chennai',
  daysPaid: 31,
  leaveBalances: { sl: 2, el: 11, cl: 3, fl: 1, lc: 0 },
  basicSalary: 48000,
  basicArrears: 0,
  hra: 21000,
  hraArrears: 0,
  performancePay: 9500,
  performanceArrears: 0,
  variableAllowance: 12500,
  variableArrears: 0,
  totalCurrentEarnings: 91000,
  totalArrearsEarnings: 0,
  totalEarnings: 91000,
  providentFund: 3600,
  incomeTax: 2200,
  professionalTax: 200,
  otherDeductionDesc: 'Desc.',
  otherDeductionAmount: 0,
  totalDeductions: 6000,
  netPay: 85000,
  retiralPf: 3600,
  retiralGratuity: 2308,
  annualIncome: 1092000,
  taxDeductions: 150000,
  netTaxIncome: 942000,
  totalTaxPayable: 46800,
  taxDeductedTillNow: 15400,
  balanceTax: 31400,
  publishedAt: '2026-10-31T12:00:00Z',
  publishedBy: '50000000-0000-0000-0000-000000000002',
  createdAt: '2026-10-31T12:00:00Z',
  updatedAt: '2026-10-31T12:00:00Z',
};

describe('PayslipsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders employee published payslips, opens breakdown modal, and downloads PDF', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/pdf')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/pdf',
            'content-disposition': 'attachment; filename="MAXR_Payslip_October_2026_EMP-0004.pdf"',
          }),
          blob: async () => new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [mockPayslip],
          meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
        <PayslipsPage />
      </AuthProvider>,
    );

    expect(await screen.findByTestId('payslip-card-2026-10')).toBeDefined();
    expect(screen.getAllByText('October 2026').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId(`view-payslip-${mockPayslip.id}`));
    expect(screen.getByText('ANANYA SEN')).toBeDefined();
    expect(screen.getByText('House Rent Allowance')).toBeDefined();

    fireEvent.click(screen.getAllByText('Download PDF')[0]!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/payslips/${mockPayslip.id}/pdf`),
        expect.anything(),
      );
    });
  });

  it('shows HR payroll management controls for HR Manager role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [mockPayslip],
          meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        }),
      }),
    );

    render(
      <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
        <PayslipsPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('HR Payroll Management')).toBeDefined();
    expect(screen.getByTestId('create-payslip-btn')).toBeDefined();
  });
});
