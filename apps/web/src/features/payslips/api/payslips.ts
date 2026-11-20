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
  payslip: Pick<PayslipRecord, 'id' | 'periodLabel' | 'employeeCode'>,
): Promise<string> {
  const res = await apiFetch(`/api/v1/payslips/${payslip.id}/pdf`);
  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json() : null;
    throw new PayslipsApiError(
      payload?.error?.message ?? `Failed to download payslip (${res.status})`,
      res.status,
      payload?.error?.code ?? 'PAYSLIP_PDF_ERROR',
    );
  }
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
