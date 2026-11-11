import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/client';
import { Button, EmptyState, ErrorState, Modal, Skeleton } from '../../../components/ui';
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
  const [employees, setEmployees] = useState<DirectoryEmployeeOption[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);
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
    leaveBalances: { sl: 4, el: 12, cl: 4, fl: 1, lc: 0 },
    basicSalary: 45000,
    hra: 18000,
    performancePay: 10000,
    variableAllowance: 12000,
    providentFund: 5400,
    incomeTax: 2200,
    professionalTax: 200,
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
      setActionError('Please select an employee.');
      return;
    }
    try {
      setSubmittingCreate(true);
      setActionError(null);
      await handleCreate(formState);
      setIsCreateOpen(false);
      setDownloadToast('Payslip record created.');
      setTimeout(() => setDownloadToast(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create payslip');
    } finally {
      setSubmittingCreate(false);
    }
  };

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
                onClick={() => setIsCreateOpen(true)}
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
        <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
          Month
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : '')}
            className="rounded-input border border-border-strong bg-surface-raised px-2.5 py-1.5 text-xs text-text"
            aria-label="Filter by month"
          >
            <option value="">All Months</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
          Year
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : '')}
            className="rounded-input border border-border-strong bg-surface-raised px-2.5 py-1.5 text-xs text-text"
            aria-label="Filter by year"
          >
            <option value="">All Years</option>
            {[2026, 2025, 2024].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </label>

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
        >
          <div className="space-y-4 text-xs text-text">
            <div className="flex flex-wrap justify-between items-center pb-3 border-b border-border gap-2">
              <div>
                <p className="font-bold text-sm">{previewSlip.employeeName.toUpperCase()}</p>
                <p className="text-text-muted">
                  {previewSlip.employeeCode} &middot; {previewSlip.designation}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-muted p-3 rounded-tile">
              <div>
                <p className="font-semibold text-text-muted mb-1">Employee Details</p>
                <p>UAN: {previewSlip.uan || '—'}</p>
                <p>PAN: {previewSlip.pan || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-text-muted mb-1">Payment & Leave</p>
                <p>Bank: {previewSlip.bankName || '—'}</p>
                <p>Acc: {previewSlip.accountNumber || '—'}</p>
                <p>Days Paid: {previewSlip.daysPaid}</p>
              </div>
              <div>
                <p className="font-semibold text-text-muted mb-1">Location Details</p>
                <p>Location: {previewSlip.workLocation || '—'}</p>
                <p>Branch: {previewSlip.baseBranch || '—'}</p>
                <p>Beneficiary: {previewSlip.beneficiaryId || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-border rounded-tile p-3 space-y-1.5">
                <p className="font-bold text-primary-ink border-b border-border pb-1">Earnings</p>
                <div className="flex justify-between">
                  <span>Basic Salary</span>
                  <span>{formatInr(previewSlip.basicSalary + previewSlip.basicArrears)}</span>
                </div>
                <div className="flex justify-between">
                  <span>House Rent Allowance</span>
                  <span>{formatInr(previewSlip.hra + previewSlip.hraArrears)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Performance Pay</span>
                  <span>
                    {formatInr(previewSlip.performancePay + previewSlip.performanceArrears)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Variable Allowance</span>
                  <span>
                    {formatInr(previewSlip.variableAllowance + previewSlip.variableArrears)}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-border">
                  <span>Total Earnings</span>
                  <span>{formatInr(previewSlip.totalEarnings)}</span>
                </div>
              </div>

              <div className="border border-border rounded-tile p-3 space-y-1.5">
                <p className="font-bold text-primary-ink border-b border-border pb-1">Deductions</p>
                <div className="flex justify-between">
                  <span>Provident Fund</span>
                  <span>{formatInr(previewSlip.providentFund)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Income Tax</span>
                  <span>{formatInr(previewSlip.incomeTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Professional Tax</span>
                  <span>{formatInr(previewSlip.professionalTax)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-border">
                  <span>Total Deductions</span>
                  <span>{formatInr(previewSlip.totalDeductions)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-primary-ink pt-2">
                  <span>Net Pay (INR)</span>
                  <span>{formatInr(previewSlip.netPay)}</span>
                </div>
              </div>
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
        >
          <form onSubmit={(e) => void onCreateSubmit(e)} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="font-semibold text-text-muted">Employee</span>
                <select
                  required
                  value={formState.employeeId}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.id === e.target.value);
                    setFormState((prev) => ({
                      ...prev,
                      employeeId: e.target.value,
                      designation: emp?.designation?.title ?? prev.designation,
                    }));
                  }}
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Month</span>
                <select
                  value={formState.payMonth}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, payMonth: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Year</span>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={formState.payYear}
                  onChange={(e) => setFormState((p) => ({ ...p, payYear: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="font-semibold text-text-muted">Basic Salary (INR)</span>
                <input
                  type="number"
                  min={0}
                  required
                  value={formState.basicSalary}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, basicSalary: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">HRA (INR)</span>
                <input
                  type="number"
                  min={0}
                  value={formState.hra ?? 0}
                  onChange={(e) => setFormState((p) => ({ ...p, hra: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Performance Pay</span>
                <input
                  type="number"
                  min={0}
                  value={formState.performancePay ?? 0}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, performancePay: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Variable Allowance</span>
                <input
                  type="number"
                  min={0}
                  value={formState.variableAllowance ?? 0}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, variableAllowance: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="font-semibold text-text-muted">Provident Fund</span>
                <input
                  type="number"
                  min={0}
                  value={formState.providentFund ?? 0}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, providentFund: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Income Tax</span>
                <input
                  type="number"
                  min={0}
                  value={formState.incomeTax ?? 0}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, incomeTax: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Professional Tax</span>
                <input
                  type="number"
                  min={0}
                  value={formState.professionalTax ?? 0}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, professionalTax: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-text-muted">Status</span>
                <select
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((p) => ({
                      ...p,
                      status: e.target.value as 'draft' | 'published',
                    }))
                  }
                  className="mt-1 w-full rounded-input border border-border-strong bg-surface-raised px-2.5 py-2 text-text"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
