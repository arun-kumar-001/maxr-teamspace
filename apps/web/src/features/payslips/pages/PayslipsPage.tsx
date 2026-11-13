import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/client';
import {
  Button,
  DropdownSelect,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
} from '../../../components/ui';
import { usePayslips } from '../hooks/usePayslips';
import type { CreatePayslipInput, PayslipRecord } from '../types';

const MONTHS = [
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
];

function formatInr(amount: number): string {
  return `₹ ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface DirectoryEmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: { title: string } | null;
}

interface LeaveBalanceApiRow {
  code?: string;
  name?: string;
  remaining?: number;
}

function mapLeaveBalancesToSnapshot(items: LeaveBalanceApiRow[]): {
  sl: number;
  el: number;
  cl: number;
  fl: number;
  lc: number;
} {
  const result = { sl: 0, el: 0, cl: 0, fl: 0, lc: 0 };
  for (const item of items) {
    const code = (item.code ?? '').trim().toUpperCase();
    const name = (item.name ?? '').trim().toUpperCase();
    const val = Number(item.remaining ?? 0);
    if (!Number.isFinite(val)) continue;
    if (code === 'SL' || code === 'SICK' || name.includes('SICK')) result.sl = val;
    else if (
      code === 'EL' ||
      code === 'EARNED' ||
      name.includes('EARNED') ||
      name.includes('PRIVILEGE')
    )
      result.el = val;
    else if (code === 'CL' || code === 'CASUAL' || name.includes('CASUAL')) result.cl = val;
    else if (
      code === 'FL' ||
      code === 'FLOATING' ||
      name.includes('FLOATING') ||
      name.includes('OPTIONAL')
    )
      result.fl = val;
    else if (code === 'LC' || (name.includes('LEAVE') && name.includes('COMP'))) result.lc = val;
  }
  return result;
}

export const PayslipsPage: React.FC = () => {
  const {
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
  } = usePayslips();

  const [activeTab, setActiveTab] = useState<'mine' | 'manage'>('mine');
  const [previewSlip, setPreviewSlip] = useState<PayslipRecord | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // HR/Admin create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<'salary' | 'details' | 'tax'>('salary');
  const [showArrears, setShowArrears] = useState(false);
  const [leaveSyncStatus, setLeaveSyncStatus] = useState<'idle' | 'loading' | 'synced' | 'empty'>(
    'idle',
  );
  const [employees, setEmployees] = useState<DirectoryEmployeeOption[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreatePayslipInput>({
    employeeId: '',
    payMonth: 10,
    payYear: 2026,
    status: 'draft',
    designation: '',
    uan: '',
    pan: '',
    bankName: '',
    accountNumber: '',
    beneficiaryId: '',
    workLocation: 'Chennai',
    baseBranch: 'Chennai',
    subLocation: 'Chennai',
    daysPaid: 31,
    leaveBalances: { sl: 0, el: 0, cl: 0, fl: 0, lc: 0 },
    basicSalary: 45000,
    basicArrears: 0,
    hra: 18000,
    hraArrears: 0,
    performancePay: 10000,
    performanceArrears: 0,
    variableAllowance: 12000,
    variableArrears: 0,
    providentFund: 5400,
    incomeTax: 2200,
    professionalTax: 200,
    otherDeductionDesc: 'Desc.',
    otherDeductionAmount: 0,
    retiralPf: 5400,
    retiralGratuity: 2165,
    annualIncome: 1020000,
    taxDeductions: 150000,
    netTaxIncome: 870000,
    totalTaxPayable: 39000,
    taxDeductedTillNow: 22000,
    balanceTax: 17000,
  });

  useEffect(() => {
    if (!canManage || !isCreateOpen || !formState.employeeId) return;
    let cancelled = false;
    setLeaveSyncStatus('loading');
    void (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/leave-balances?employeeId=${encodeURIComponent(formState.employeeId)}&year=${formState.payYear}&pageSize=50`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: LeaveBalanceApiRow[] };
        const rows = json.data ?? [];
        if (cancelled) return;
        const mapped = mapLeaveBalancesToSnapshot(rows);
        setFormState((prev) => ({
          ...prev,
          leaveBalances: mapped,
        }));
        setLeaveSyncStatus(rows.length > 0 ? 'synced' : 'empty');
      } catch {
        if (!cancelled) setLeaveSyncStatus('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, isCreateOpen, formState.employeeId, formState.payYear]);

  useEffect(() => {
    if (!canManage || !isCreateOpen || employees.length > 0) return;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/employees?pageSize=100');
        if (res.ok) {
          const json = (await res.json()) as { data?: DirectoryEmployeeOption[] };
          const list = json.data ?? [];
          setEmployees(list);
          if (list[0]) {
            setFormState((prev) => ({
              ...prev,
              employeeId: prev.employeeId || list[0]!.id,
              designation: prev.designation || list[0]!.designation?.title || '',
            }));
          }
        }
      } catch {
        // Directory load best-effort in modal
      }
    })();
  }, [canManage, isCreateOpen, employees.length]);

  const activeRecords = activeTab === 'manage' && canManage ? allPayslips : myPayslips;
  const latestSlip = useMemo(() => myPayslips[0] ?? null, [myPayslips]);

  const onDownload = async (slip: PayslipRecord) => {
    try {
      setActionError(null);
      const filename = await handleDownload(slip);
      setDownloadToast(`Downloaded ${filename}`);
      setTimeout(() => setDownloadToast(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to download payslip PDF');
    }
  };

  const onPublish = async (id: string) => {
    try {
      setActionError(null);
      await handlePublish(id);
      setDownloadToast('Payslip published to employee portal.');
      setTimeout(() => setDownloadToast(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to publish payslip');
    }
  };

  const onCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.employeeId) {
      setCreateError('Please select an employee.');
      return;
    }
    try {
      setSubmittingCreate(true);
      setCreateError(null);
      setActionError(null);
      await handleCreate(formState);
      setIsCreateOpen(false);
      setDownloadToast('Payslip record created.');
      setTimeout(() => setDownloadToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create payslip';
      setCreateError(msg);
      setActionError(msg);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const draftGross =
    (formState.basicSalary || 0) +
    (formState.basicArrears || 0) +
    (formState.hra || 0) +
    (formState.hraArrears || 0) +
    (formState.performancePay || 0) +
    (formState.performanceArrears || 0) +
    (formState.variableAllowance || 0) +
    (formState.variableArrears || 0);
  const draftDeductions =
    (formState.providentFund || 0) +
    (formState.incomeTax || 0) +
    (formState.professionalTax || 0) +
    (formState.otherDeductionAmount || 0);
  const draftNetPay = draftGross - draftDeductions;

  const fieldClass =
    'mt-1 h-9 w-full rounded-xl border border-border-strong bg-surface-raised px-2.5 text-xs text-text tabular-nums focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary-soft';

  return (
    <div className="space-y-6" data-testid="payslips-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
            Payslip Statements
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            View monthly salary breakdown and download official A4 payslip PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <div className="inline-flex rounded-input bg-surface-muted p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('mine')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'mine'
                      ? 'bg-surface-raised text-text shadow-xs'
                      : 'text-text-muted'
                  }`}
                >
                  My Payslips
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'manage'
                      ? 'bg-surface-raised text-text shadow-xs'
                      : 'text-text-muted'
                  }`}
                >
                  HR Payroll Management
                </button>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                data-testid="create-payslip-btn"
              >
                + New Payslip
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      {downloadToast && (
        <div
          className="rounded-input px-4 py-2.5 text-sm font-medium border border-primary/40 bg-primary-soft text-primary-ink"
          role="status"
        >
          {downloadToast}
        </div>
      )}
      {actionError && (
        <div
          className="rounded-input px-4 py-2.5 text-sm font-medium border border-danger/30 bg-danger/10 text-danger"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-card bg-surface border border-border p-4 shadow-card">
          <p className="text-xs font-medium text-text-muted">Latest Net Pay</p>
          <p className="text-2xl font-bold font-display text-text mt-1">
            {latestSlip ? formatInr(latestSlip.netPay) : '—'}
          </p>
          <p className="text-xs text-text-subtle mt-1">
            {latestSlip ? latestSlip.periodLabel : 'No published payslips yet'}
          </p>
        </div>
        <div className="rounded-card bg-surface border border-border p-4 shadow-card">
          <p className="text-xs font-medium text-text-muted">Latest Gross Earnings</p>
          <p className="text-2xl font-bold font-display text-text mt-1">
            {latestSlip ? formatInr(latestSlip.totalEarnings) : '—'}
          </p>
          <p className="text-xs text-text-subtle mt-1">
            {latestSlip ? `${latestSlip.daysPaid} days paid` : 'Awaiting payroll release'}
          </p>
        </div>
        <div className="rounded-card bg-surface border border-border p-4 shadow-card">
          <p className="text-xs font-medium text-text-muted">Published Statements</p>
          <p className="text-2xl font-bold font-display text-primary-ink mt-1">
            {myPayslips.length}
          </p>
          <p className="text-xs text-text-subtle mt-1">Read-only verified statements</p>
        </div>
      </div>

      {/* Period Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface border border-border p-3.5">
        <div className="text-xs font-semibold text-text-muted flex items-center gap-2">
          <span>Month</span>
          <div className="w-36">
            <DropdownSelect
              ariaLabel="Filter by month"
              value={selectedMonth === '' ? '' : String(selectedMonth)}
              onChange={(val) => setSelectedMonth(val ? Number(val) : '')}
              options={[
                { value: '', label: 'All Months' },
                ...MONTHS.map((m, idx) => ({ value: String(idx + 1), label: m })),
              ]}
              className="h-9"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-text-muted flex items-center gap-2">
          <span>Year</span>
          <div className="w-28">
            <DropdownSelect
              ariaLabel="Filter by year"
              value={selectedYear === '' ? '' : String(selectedYear)}
              onChange={(val) => setSelectedYear(val ? Number(val) : '')}
              options={[
                { value: '', label: 'All Years' },
                ...[2026, 2025, 2024].map((yr) => ({ value: String(yr), label: String(yr) })),
              ]}
              className="h-9"
            />
          </div>
        </div>

        {(selectedMonth !== '' || selectedYear !== '') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMonth('');
              setSelectedYear('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="space-y-3 rounded-card bg-surface border border-border p-6">
          <Skeleton variant="rectangular" height={44} className="w-full" />
          <Skeleton variant="rectangular" height={44} className="w-full" />
          <Skeleton variant="rectangular" height={44} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Could not load payslips" message={error} onRetry={refresh} />
      ) : activeRecords.length === 0 ? (
        <EmptyState
          title="No payslips found"
          description={
            activeTab === 'manage'
              ? 'Create a payslip record using the + New Payslip button.'
              : 'Published monthly payslips will appear here once released by HR.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeRecords.map((slip) => (
            <div
              key={slip.id}
              className="rounded-card bg-surface border border-border p-5 shadow-card flex flex-col justify-between gap-4 hover:shadow-raised transition-shadow"
              data-testid={`payslip-card-${slip.payYear}-${slip.payMonth}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold font-display text-text">{slip.periodLabel}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {slip.employeeName} &middot; {slip.employeeCode}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      slip.status === 'published'
                        ? 'bg-primary-soft text-primary-ink'
                        : 'bg-surface-muted text-text-muted'
                    }`}
                  >
                    {slip.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-subtle block">Gross Earnings</span>
                    <span className="font-semibold text-text">{formatInr(slip.totalEarnings)}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Total Deductions</span>
                    <span className="font-semibold text-text">
                      {formatInr(slip.totalDeductions)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-subtle block">Net Pay</span>
                    <span className="text-lg font-bold font-display text-primary-ink">
                      {formatInr(slip.netPay)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewSlip(slip)}
                  data-testid={`view-payslip-${slip.id}`}
                >
                  View Breakdown
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={downloadingId === slip.id}
                  onClick={() => void onDownload(slip)}
                  data-testid={`download-payslip-${slip.id}`}
                >
                  {downloadingId === slip.id ? 'Generating PDF...' : 'Download PDF'}
                </Button>
                {canManage && slip.status === 'draft' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={publishingId === slip.id}
                    onClick={() => void onPublish(slip.id)}
                  >
                    {publishingId === slip.id ? 'Publishing...' : 'Publish'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Breakdown Preview Modal */}
      {previewSlip && (
        <Modal
          isOpen={Boolean(previewSlip)}
          onClose={() => setPreviewSlip(null)}
          title={`Payslip — ${previewSlip.periodLabel}`}
          subtitle="Read-only verified monthly salary statement"
          maxWidth="2xl"
        >
          <div className="space-y-3.5 text-xs text-text">
            <div className="flex flex-wrap justify-between items-center pb-3 border-b border-border gap-3">
              <div>
                <p className="font-bold text-sm font-display text-text">
                  {previewSlip.employeeName.toUpperCase()}
                </p>
                <p className="text-text-muted mt-0.5">
                  {previewSlip.employeeCode} &middot; {previewSlip.designation || 'Employee'}
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void onDownload(previewSlip)}
              >
                Download PDF
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-border/70 pb-1">
                  Employee Details
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Emp ID</span>
                  <span className="font-medium text-text tabular-nums">
                    {previewSlip.employeeCode || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">UAN</span>
                  <span className="font-medium text-text tabular-nums">
                    {previewSlip.uan || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">PAN</span>
                  <span className="font-medium text-text tabular-nums">
                    {previewSlip.pan || 'None'}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-border/70 pb-1">
                  Payment &amp; Leave
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted shrink-0">Bank</span>
                  <span className="font-medium text-text text-right truncate">
                    {previewSlip.bankName || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted shrink-0">Acc</span>
                  <span className="font-medium text-text tabular-nums truncate">
                    {previewSlip.accountNumber || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Days Paid</span>
                  <span className="font-medium text-text tabular-nums">{previewSlip.daysPaid}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-border/70 pb-1">
                  Location Details
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Location</span>
                  <span className="font-medium text-text">
                    {previewSlip.workLocation || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Branch</span>
                  <span className="font-medium text-text">{previewSlip.baseBranch || 'None'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Beneficiary</span>
                  <span className="font-medium text-text tabular-nums">
                    {previewSlip.beneficiaryId || 'None'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="border border-border rounded-tile p-3.5 bg-surface flex flex-col justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary-ink border-b border-border pb-1.5">
                    Earnings
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Basic Salary</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.basicSalary + previewSlip.basicArrears)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">House Rent Allowance</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.hra + previewSlip.hraArrears)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Performance Pay</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.performancePay + previewSlip.performanceArrears)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Variable Allowance</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.variableAllowance + previewSlip.variableArrears)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 font-bold pt-2 border-t border-border">
                  <span>Total Earnings</span>
                  <span className="font-display tabular-nums whitespace-nowrap">
                    {formatInr(previewSlip.totalEarnings)}
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-tile p-3.5 bg-surface flex flex-col justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-border pb-1.5">
                    Deductions
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Provident Fund</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.providentFund)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Income Tax</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.incomeTax)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Professional Tax</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatInr(previewSlip.professionalTax)}
                    </span>
                  </div>
                  {previewSlip.otherDeductionAmount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">
                        {previewSlip.otherDeductionDesc || 'Other Deduction'}
                      </span>
                      <span className="font-medium tabular-nums whitespace-nowrap">
                        {formatInr(previewSlip.otherDeductionAmount)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 font-bold pt-2 border-t border-border">
                  <span>Total Deductions</span>
                  <span className="font-display tabular-nums whitespace-nowrap">
                    {formatInr(previewSlip.totalDeductions)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-tile bg-primary-soft/70 border border-primary/30 px-4 py-2.5">
              <span className="text-xs font-bold text-text">Net Pay (INR)</span>
              <span className="text-lg font-bold font-display text-primary-ink tabular-nums whitespace-nowrap">
                {formatInr(previewSlip.netPay)}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* HR/Admin Create Payslip Modal */}
      {canManage && isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Employee Payslip"
          subtitle="Configure pay period, earnings, and deductions before saving."
          maxWidth="2xl"
        >
          <form onSubmit={(e) => void onCreateSubmit(e)} className="space-y-3 text-xs">
            {createError && (
              <div
                className="rounded-xl px-3 py-2 text-xs font-medium border border-danger/30 bg-danger/10 text-danger"
                role="alert"
              >
                {createError}
              </div>
            )}

            {/* Modal Section Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-tile bg-surface-muted p-1 border border-border">
              {[
                { id: 'salary', label: 'Salary & Period' },
                { id: 'details', label: 'Bank, Location & Leave' },
                { id: 'tax', label: 'Retirals & Annual Tax' },
              ].map((tab) => {
                const active = createTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCreateTab(tab.id as 'salary' | 'details' | 'tax')}
                    className={`flex-1 min-w-[140px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? 'bg-surface-raised text-primary-ink shadow-sm border border-border'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {createTab === 'salary' && (
              <>
                {/* Employee & Pay Period */}
                <div className="rounded-tile bg-surface-muted/70 border border-border p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Employee &amp; Pay Period
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5">
                    <div className="block col-span-2 sm:col-span-4">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Employee
                      </span>
                      <div className="mt-1">
                        <DropdownSelect
                          ariaLabel="Employee"
                          placeholder="Select Employee"
                          value={formState.employeeId}
                          onChange={(val) => {
                            const emp = employees.find((x) => x.id === val);
                            setFormState((prev) => ({
                              ...prev,
                              employeeId: val,
                              designation: emp?.designation?.title ?? prev.designation,
                            }));
                          }}
                          options={employees.map((emp) => ({
                            value: emp.id,
                            label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                          }))}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="block sm:col-span-2">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Month
                      </span>
                      <div className="mt-1">
                        <DropdownSelect
                          ariaLabel="Pay Month"
                          value={String(formState.payMonth)}
                          onChange={(val) => setFormState((p) => ({ ...p, payMonth: Number(val) }))}
                          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <label className="block sm:col-span-2">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Year
                      </span>
                      <input
                        type="number"
                        min={2020}
                        max={2100}
                        value={formState.payYear}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, payYear: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Days Paid
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        value={formState.daysPaid ?? 30}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, daysPaid: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>

                    <div className="block sm:col-span-2">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Status
                      </span>
                      <div className="mt-1">
                        <DropdownSelect
                          ariaLabel="Status"
                          value={formState.status ?? 'draft'}
                          onChange={(val) =>
                            setFormState((p) => ({
                              ...p,
                              status: val as 'draft' | 'published',
                            }))
                          }
                          options={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'published', label: 'Published' },
                          ]}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Earnings & Deductions Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-ink">
                        Earnings (INR)
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowArrears((v) => !v)}
                        className="text-[11px] font-semibold text-primary-ink hover:underline"
                      >
                        {showArrears ? 'Hide Arrears' : '+ Add Arrears'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Basic Salary
                        </span>
                        <input
                          type="number"
                          min={0}
                          required
                          value={formState.basicSalary}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, basicSalary: Number(e.target.value) }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          HRA
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.hra ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, hra: Number(e.target.value) }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Performance Pay
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.performancePay ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, performancePay: Number(e.target.value) }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Variable Allow.
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.variableAllowance ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              variableAllowance: Number(e.target.value),
                            }))
                          }
                          className={fieldClass}
                        />
                      </label>
                    </div>
                    {showArrears && (
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/70">
                        <label className="block">
                          <span className="font-semibold text-text-muted block whitespace-nowrap">
                            Basic Arrears
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={formState.basicArrears ?? 0}
                            onChange={(e) =>
                              setFormState((p) => ({ ...p, basicArrears: Number(e.target.value) }))
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label className="block">
                          <span className="font-semibold text-text-muted block whitespace-nowrap">
                            HRA Arrears
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={formState.hraArrears ?? 0}
                            onChange={(e) =>
                              setFormState((p) => ({ ...p, hraArrears: Number(e.target.value) }))
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label className="block">
                          <span className="font-semibold text-text-muted block whitespace-nowrap">
                            Perf. Arrears
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={formState.performanceArrears ?? 0}
                            onChange={(e) =>
                              setFormState((p) => ({
                                ...p,
                                performanceArrears: Number(e.target.value),
                              }))
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label className="block">
                          <span className="font-semibold text-text-muted block whitespace-nowrap">
                            Var. Arrears
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={formState.variableArrears ?? 0}
                            onChange={(e) =>
                              setFormState((p) => ({
                                ...p,
                                variableArrears: Number(e.target.value),
                              }))
                            }
                            className={fieldClass}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Deductions (INR)
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Provident Fund
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.providentFund ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, providentFund: Number(e.target.value) }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Income Tax
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.incomeTax ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, incomeTax: Number(e.target.value) }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Professional Tax
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.professionalTax ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              professionalTax: Number(e.target.value),
                            }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Other Deduction
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={formState.otherDeductionAmount ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              otherDeductionAmount: Number(e.target.value),
                            }))
                          }
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {createTab === 'details' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary-ink">
                      Employee &amp; Bank Details
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Designation
                        </span>
                        <input
                          type="text"
                          value={formState.designation ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, designation: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          UAN
                        </span>
                        <input
                          type="text"
                          value={formState.uan ?? ''}
                          onChange={(e) => setFormState((p) => ({ ...p, uan: e.target.value }))}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          PAN
                        </span>
                        <input
                          type="text"
                          value={formState.pan ?? ''}
                          onChange={(e) => setFormState((p) => ({ ...p, pan: e.target.value }))}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Bank Name
                        </span>
                        <input
                          type="text"
                          value={formState.bankName ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, bankName: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Acc No.
                        </span>
                        <input
                          type="text"
                          value={formState.accountNumber ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, accountNumber: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Beneficiary ID
                        </span>
                        <input
                          type="text"
                          value={formState.beneficiaryId ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, beneficiaryId: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Location &amp; Deduction Label
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Location
                        </span>
                        <input
                          type="text"
                          value={formState.workLocation ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              workLocation: e.target.value,
                              subLocation: e.target.value,
                            }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Base Br.
                        </span>
                        <input
                          type="text"
                          value={formState.baseBranch ?? ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, baseBranch: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          Other Deduction Label
                        </span>
                        <input
                          type="text"
                          value={formState.otherDeductionDesc ?? 'Desc.'}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, otherDeductionDesc: e.target.value }))
                          }
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Auto-synced Leave Balances */}
                <div className="rounded-tile border border-border bg-surface-muted/70 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary-ink">
                      Leave Details ({formState.payYear})
                    </p>
                    <span className="text-[11px] font-medium text-text-muted">
                      {leaveSyncStatus === 'loading'
                        ? 'Fetching from Leave module...'
                        : leaveSyncStatus === 'synced'
                          ? 'Auto-synced from Leave balances'
                          : 'No leave records for year (defaults to 0)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {(
                      [
                        ['sl', 'SL'],
                        ['el', 'EL'],
                        ['cl', 'CL'],
                        ['fl', 'FL'],
                        ['lc', 'LC'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="font-semibold text-text-muted block whitespace-nowrap">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          step="0.5"
                          value={formState.leaveBalances?.[key] ?? 0}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              leaveBalances: {
                                ...p.leaveBalances,
                                [key]: Number(e.target.value),
                              },
                            }))
                          }
                          className={fieldClass}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {createTab === 'tax' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary-ink">
                    Retirals as on Month end
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Provident Fund (INR)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.retiralPf ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, retiralPf: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Gratuity (INR)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.retiralGratuity ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, retiralGratuity: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-tile border border-border bg-surface p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Projected Annual Tax Information
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Annual Income
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.annualIncome ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, annualIncome: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Deductions (if any)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.taxDeductions ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, taxDeductions: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        NetTax Income
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.netTaxIncome ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, netTaxIncome: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Total Tax Payable
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.totalTaxPayable ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, totalTaxPayable: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Tax deducted till now
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.taxDeductedTillNow ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            taxDeductedTillNow: Number(e.target.value),
                          }))
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-text-muted block whitespace-nowrap">
                        Balance Tax
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={formState.balanceTax ?? 0}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, balanceTax: Number(e.target.value) }))
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Live Calculation Preview */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-tile bg-primary-soft/70 border border-primary/30 px-3.5 py-2">
              <div className="flex flex-wrap items-center gap-5 text-xs">
                <div>
                  <span className="text-text-muted block text-[11px]">Gross Earnings</span>
                  <span className="font-semibold text-text font-display tabular-nums">
                    {formatInr(draftGross)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Total Deductions</span>
                  <span className="font-semibold text-text font-display tabular-nums">
                    {formatInr(draftDeductions)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-text-muted block text-[11px]">Estimated Net Pay</span>
                <span className="text-base font-bold text-primary-ink font-display tabular-nums">
                  {formatInr(draftNetPay)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2.5 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submittingCreate}>
                {submittingCreate ? 'Saving...' : 'Save Payslip'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
