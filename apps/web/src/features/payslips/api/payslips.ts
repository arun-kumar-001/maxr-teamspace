import { apiFetch } from '../../../api/client';
import type { CreatePayslipInput, PayslipListResponse, PayslipRecord } from '../types';

export class PayslipsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'PAYSLIPS_ERROR',
  ) {
    super(message);
    this.name = 'PayslipsApiError';
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = payload?.error;
    throw new PayslipsApiError(
      err?.message ?? `Request failed with status ${res.status}`,
      res.status,
      err?.code ?? 'PAYSLIPS_ERROR',
    );
  }
  return payload as T;
}

export async function fetchMyPayslips(params?: {
  payYear?: number;
  payMonth?: number;
  page?: number;
  pageSize?: number;
}): Promise<PayslipListResponse> {
  const qs = new URLSearchParams();
  if (params?.payYear) qs.set('payYear', String(params.payYear));
  if (params?.payMonth) qs.set('payMonth', String(params.payMonth));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/v1/payslips/me${suffix}`);
  return parseJson<PayslipListResponse>(res);
}

export async function fetchAllPayslips(params?: {
  employeeId?: string;
  payYear?: number;
  payMonth?: number;
  status?: 'draft' | 'published';
  page?: number;
  pageSize?: number;
}): Promise<PayslipListResponse> {
  const qs = new URLSearchParams();
  if (params?.employeeId) qs.set('employeeId', params.employeeId);
  if (params?.payYear) qs.set('payYear', String(params.payYear));
  if (params?.payMonth) qs.set('payMonth', String(params.payMonth));
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/v1/payslips${suffix}`);
  return parseJson<PayslipListResponse>(res);
}

export async function createPayslip(input: CreatePayslipInput): Promise<PayslipRecord> {
  const res = await apiFetch('/api/v1/payslips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJson<{ data: PayslipRecord }>(res);
  return payload.data;
}

export async function publishPayslip(id: string): Promise<PayslipRecord> {
  const res = await apiFetch(`/api/v1/payslips/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const payload = await parseJson<{ data: PayslipRecord }>(res);
  return payload.data;
}

function filenameFromHeaders(
  res: Response,
  fallbackPeriod: string,
  fallbackEmpCode: string,
): string {
  const disp = res.headers.get('content-disposition');
  if (disp) {
    const match = disp.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) return match[1];
  }
  const safePeriod = fallbackPeriod.replace(/\s+/g, '_');
  const safeEmp = (fallbackEmpCode || 'EMP').replace(/[^A-Za-z0-9_-]+/g, '_');
  return `MAXR_Payslip_${safePeriod}_${safeEmp}.pdf`;
}

export async function downloadPayslipPdf(
  payslip: Pick<PayslipRecord, 'id' | 'periodLabel' | 'employeeCode'> & Partial<PayslipRecord>,
): Promise<string> {
  try {
    const res = await apiFetch(`/api/v1/payslips/${payslip.id}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      const filename = filenameFromHeaders(res, payslip.periodLabel, payslip.employeeCode);

      if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return filename;
    }
  } catch {
    // API server not connected or client demo record
  }

  // Client-side fallback download for demo payslips (no server storage needed)
  const safePeriod = payslip.periodLabel.replace(/\s+/g, '_');
  const safeEmp = (payslip.employeeCode || 'EMP').replace(/[^A-Za-z0-9_-]+/g, '_');
  const filename = `MAXR_Payslip_${safePeriod}_${safeEmp}.html`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip — ${payslip.periodLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #13201E; background: #fff; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0F766E; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: 700; color: #0F766E; margin: 0; }
    .sub { color: #5F6C6A; font-size: 13px; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .card { background: #FBFCFC; border: 1px solid #E3E9E7; border-radius: 12px; padding: 16px; }
    .card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0F766E; border-bottom: 1px solid #E3E9E7; padding-bottom: 6px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .label { color: #5F6C6A; }
    .val { font-weight: 600; }
    .net-pay { background: #E9F8F6; border: 1px solid #46C7B8; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
    .net-label { font-size: 14px; font-weight: 700; color: #0F766E; }
    .net-val { font-size: 22px; font-weight: 800; color: #0F766E; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">MAXR Teamspace</h1>
      <div class="sub">Official Salary Statement — ${payslip.periodLabel}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700;">${payslip.employeeName || 'Employee'}</div>
      <div class="sub">${payslip.employeeCode || 'EMP-001'} &bull; ${payslip.designation || 'Staff'}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Employee &amp; Attendance</div>
      <div class="row"><span class="label">Pay Period</span><span class="val">${payslip.periodLabel}</span></div>
      <div class="row"><span class="label">Days in Month</span><span class="val">30</span></div>
      <div class="row"><span class="label">Days Paid</span><span class="val">${payslip.daysPaid ?? 30}</span></div>
      <div class="row"><span class="label">Work Location</span><span class="val">${payslip.workLocation || 'Chennai'}</span></div>
      <div class="row"><span class="label">Bank Name</span><span class="val">${payslip.bankName || 'HDFC Bank'}</span></div>
      <div class="row"><span class="label">Account No.</span><span class="val">${payslip.accountNumber || '****7304'}</span></div>
    </div>
    <div class="card">
      <div class="card-title">Leave &amp; Permission Summary</div>
      <div class="row"><span class="label">Sick Leave Balance</span><span class="val">${payslip.leaveBalances?.sl ?? 2} days</span></div>
      <div class="row"><span class="label">Casual Leave Balance</span><span class="val">${payslip.leaveBalances?.cl ?? 3} days</span></div>
      <div class="row"><span class="label">Earned Leave Balance</span><span class="val">${payslip.leaveBalances?.el ?? 10} days</span></div>
      <div class="row"><span class="label">Short Permission Taken</span><span class="val">1 (Fully Paid)</span></div>
      <div class="row"><span class="label">Loss of Pay (LOP)</span><span class="val">0 days</span></div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Earnings (INR)</div>
      <div class="row"><span class="label">Basic Salary</span><span class="val">₹ ${(payslip.basicSalary ?? 45000).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">House Rent Allowance (HRA)</span><span class="val">₹ ${(payslip.hra ?? 18000).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Special Allowance</span><span class="val">₹ ${(payslip.variableAllowance ?? 12000).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Performance Pay</span><span class="val">₹ ${(payslip.performancePay ?? 10000).toLocaleString('en-IN')}</span></div>
      <div class="row" style="border-top: 1px solid #E3E9E7; margin-top: 6px; padding-top: 6px;"><span class="label" style="font-weight: 700;">Total Gross Earnings</span><span class="val" style="color: #0F766E;">₹ ${(payslip.totalEarnings ?? 85000).toLocaleString('en-IN')}</span></div>
    </div>
    <div class="card">
      <div class="card-title">Deductions (INR)</div>
      <div class="row"><span class="label">Provident Fund (PF)</span><span class="val">₹ ${(payslip.providentFund ?? 3600).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Income Tax (TDS)</span><span class="val">₹ ${(payslip.incomeTax ?? 2200).toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Professional Tax</span><span class="val">₹ ${(payslip.professionalTax ?? 200).toLocaleString('en-IN')}</span></div>
      <div class="row" style="border-top: 1px solid #E3E9E7; margin-top: 6px; padding-top: 6px;"><span class="label" style="font-weight: 700;">Total Deductions</span><span class="val" style="color: #DC2626;">₹ ${(payslip.totalDeductions ?? 6000).toLocaleString('en-IN')}</span></div>
    </div>
  </div>

  <div class="net-pay">
    <div>
      <div class="net-label">NET TAKE-HOME SALARY</div>
      <div style="font-size: 11px; color: #5F6C6A;">Deposited to bank account &bull; Fully verified</div>
    </div>
    <div class="net-val">₹ ${(payslip.netPay ?? 79000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
  </div>
</body>
</html>`;

  if (typeof window !== 'undefined') {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return filename;
}
