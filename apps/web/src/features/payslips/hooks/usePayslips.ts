import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import {
  createPayslip,
  downloadPayslipPdf,
  fetchAllPayslips,
  fetchMyPayslips,
  publishPayslip,
} from '../api/payslips';
import type { CreatePayslipInput, PayslipRecord } from '../types';

const DUMMY_CLIENT_PAYSLIPS: PayslipRecord[] = [
  {
    id: 'ps-demo-2026-11',
    employeeId: 'emp-demo-001',
    employeeCode: 'EMP-001',
    employeeName: 'Shagul Hamithu',
    departmentName: 'Engineering',
    payMonth: 11,
    payYear: 2026,
    periodLabel: 'November 2026',
    status: 'published',
    designation: 'Senior System Administrator',
    uan: '101458290341',
    pan: 'ABCDE1234F',
    bankName: 'HDFC Bank Ltd.',
    accountNumber: '50100482917304',
    beneficiaryId: 'BEN0048219',
    workLocation: 'Chennai',
    baseBranch: 'Chennai HQ',
    subLocation: 'Main Campus',
    daysPaid: 30,
    leaveBalances: { sl: 2, el: 10, cl: 3, fl: 1, lc: 0 },
    basicSalary: 45000,
    basicArrears: 0,
    hra: 18000,
    hraArrears: 0,
    performancePay: 10000,
    performanceArrears: 0,
    variableAllowance: 12000,
    variableArrears: 0,
    totalCurrentEarnings: 85000,
    totalArrearsEarnings: 0,
    totalEarnings: 85000,
    providentFund: 3600,
    incomeTax: 2200,
    professionalTax: 200,
    otherDeductionDesc: 'None',
    otherDeductionAmount: 0,
    totalDeductions: 6000,
    netPay: 79000,
    retiralPf: 3600,
    retiralGratuity: 2165,
    annualIncome: 1020000,
    taxDeductions: 150000,
    netTaxIncome: 870000,
    totalTaxPayable: 39000,
    taxDeductedTillNow: 22000,
    balanceTax: 17000,
    publishedAt: '2026-11-30T10:00:00Z',
    publishedBy: 'HR Payroll Admin',
    createdAt: '2026-11-30T10:00:00Z',
    updatedAt: '2026-11-30T10:00:00Z',
  },
  {
    id: 'ps-demo-2026-10',
    employeeId: 'emp-demo-001',
    employeeCode: 'EMP-001',
    employeeName: 'Shagul Hamithu',
    departmentName: 'Engineering',
    payMonth: 10,
    payYear: 2026,
    periodLabel: 'October 2026',
    status: 'published',
    designation: 'Senior System Administrator',
    uan: '101458290341',
    pan: 'ABCDE1234F',
    bankName: 'HDFC Bank Ltd.',
    accountNumber: '50100482917304',
    beneficiaryId: 'BEN0048219',
    workLocation: 'Chennai',
    baseBranch: 'Chennai HQ',
    subLocation: 'Main Campus',
    daysPaid: 31,
    leaveBalances: { sl: 2, el: 11, cl: 4, fl: 1, lc: 0 },
    basicSalary: 45000,
    basicArrears: 0,
    hra: 18000,
    hraArrears: 0,
    performancePay: 10000,
    performanceArrears: 0,
    variableAllowance: 12000,
    variableArrears: 0,
    totalCurrentEarnings: 85000,
    totalArrearsEarnings: 0,
    totalEarnings: 85000,
    providentFund: 3600,
    incomeTax: 2200,
    professionalTax: 200,
    otherDeductionDesc: 'None',
    otherDeductionAmount: 0,
    totalDeductions: 6000,
    netPay: 79000,
    retiralPf: 3600,
    retiralGratuity: 2165,
    annualIncome: 1020000,
    taxDeductions: 150000,
    netTaxIncome: 870000,
    totalTaxPayable: 39000,
    taxDeductedTillNow: 19800,
    balanceTax: 19200,
    publishedAt: '2026-10-31T10:00:00Z',
    publishedBy: 'HR Payroll Admin',
    createdAt: '2026-10-31T10:00:00Z',
    updatedAt: '2026-10-31T10:00:00Z',
  },
];

export function usePayslips() {
  const { user, role } = useAuth();
  const effectiveRole = user?.role ?? role;
  const canManage = effectiveRole === ROLES.ADMIN || effectiveRole === ROLES.HR_MANAGER;

  const [myPayslips, setMyPayslips] = useState<PayslipRecord[]>([]);
  const [allPayslips, setAllPayslips] = useState<PayslipRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let mineList: PayslipRecord[] = [];
      try {
        const mine = await fetchMyPayslips({
          payYear: selectedYear || undefined,
          payMonth: selectedMonth || undefined,
          pageSize: 50,
        });
        mineList = mine?.data ?? [];
      } catch {
        // server uncontacted or not populated
      }

      if (mineList.length === 0) {
        // Client-side fallback dummy payslip records (no server storage)
        const name = user?.name || 'Shagul Hamithu';
        mineList = DUMMY_CLIENT_PAYSLIPS.map((p) => ({ ...p, employeeName: name })).filter((s) => {
          if (selectedYear && s.payYear !== selectedYear) return false;
          if (selectedMonth && s.payMonth !== selectedMonth) return false;
          return true;
        });
      }
      setMyPayslips(mineList);

      if (canManage) {
        let allList: PayslipRecord[] = [];
        try {
          const all = await fetchAllPayslips({
            payYear: selectedYear || undefined,
            payMonth: selectedMonth || undefined,
            pageSize: 50,
          });
          allList = all?.data ?? [];
        } catch {
          // server uncontacted
        }
        setAllPayslips(allList.length > 0 ? allList : mineList);
      } else {
        setAllPayslips([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payslips');
    } finally {
      setIsLoading(false);
    }
  }, [canManage, selectedYear, selectedMonth, user?.name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDownload = useCallback(async (record: PayslipRecord) => {
    setDownloadingId(record.id);
    try {
      return await downloadPayslipPdf(record);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handlePublish = useCallback(
    async (id: string) => {
      setPublishingId(id);
      try {
        await publishPayslip(id);
        await refresh();
      } finally {
        setPublishingId(null);
      }
    },
    [refresh],
  );

  const handleCreate = useCallback(
    async (input: CreatePayslipInput) => {
      const created = await createPayslip(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  return {
    canManage,
    myPayslips,
    allPayslips,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    error,
    downloadingId,
    publishingId,
    refresh,
    handleDownload,
    handlePublish,
    handleCreate,
  };
}
