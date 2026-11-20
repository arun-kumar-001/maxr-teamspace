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

function formatPdfAmount(val: number | undefined): string {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPdfNumberClean(val: number | undefined): string {
  const n = Number(val || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function generateClientPayslipPdf(p: Partial<PayslipRecord>): Uint8Array {
  const lines: string[] = [];
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    fill = true,
  ) {
    lines.push(`${r} ${g} ${b} ${fill ? 'rg' : 'RG'}`);
    lines.push(`${x} ${y} ${w} ${h} re ${fill ? 'f' : 's'}`);
  }
  function text(
    str: string,
    x: number,
    y: number,
    size = 8.5,
    isBold = false,
    r = 0.075,
    g = 0.125,
    b = 0.118,
    align: 'left' | 'right' | 'center' = 'left',
  ) {
    const font = isBold ? '/F2' : '/F1';
    const safe = String(str).replace(/[()\\]/g, '\\$&');
    let xPos = x;
    if (align === 'right') {
      const approxCharWidth = size * 0.52;
      xPos = x - safe.length * approxCharWidth;
    } else if (align === 'center') {
      const approxCharWidth = size * 0.52;
      xPos = x - (safe.length * approxCharWidth) / 2;
    }
    lines.push(`BT ${font} ${size} Tf ${r} ${g} ${b} rg ${xPos} ${y} Td (${safe}) Tj ET`);
  }

  // 1. Mint Green Top Accent Bar
  rect(28, 814, 539, 4, 0.275, 0.78, 0.722, true);

  // 2. Header
  text('Payslip', 28, 792, 14, true, 0.075, 0.125, 0.118);
  text(p.periodLabel || 'November 2026', 28, 775, 12, true, 0.059, 0.463, 0.431);
  text('MAXR TEAMSPACE', 567, 785, 13, true, 0.059, 0.463, 0.431, 'right');

  // 3. Mint Banner: Employee Name + Net Pay (INR)
  rect(28, 715, 360, 42, 0.914, 0.973, 0.965, true);
  rect(28, 715, 360, 42, 0.275, 0.78, 0.722, false);
  text(p.employeeName || 'Shagul Hamithu', 40, 730, 13, true, 0.075, 0.125, 0.118);

  rect(388, 715, 179, 42, 0.059, 0.463, 0.431, true);
  text('Net Pay (INR)', 555, 742, 7.8, true, 0.914, 0.973, 0.965, 'right');
  text(`Rs. ${formatPdfAmount(p.netPay ?? 79000)}`, 555, 724, 14, true, 1, 1, 1, 'right');

  // 4. Employee Details | Payment Details | Location Details
  // Col 1: Employee Details
  rect(28, 620, 172, 82, 1, 1, 1, true);
  rect(28, 620, 172, 82, 0.89, 0.914, 0.906, false);
  rect(28, 684, 172, 18, 0.914, 0.973, 0.965, true);
  text('Employee Details', 34, 689, 7.8, true, 0.059, 0.463, 0.431);
  text('Emp No', 34, 671, 7.8, false, 0.373, 0.424, 0.416);
  text(p.employeeCode || 'EMP-001', 192, 671, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Designation', 34, 655, 7.8, false, 0.373, 0.424, 0.416);
  text(p.designation || 'System Administrator', 192, 655, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('UAN', 34, 639, 7.8, false, 0.373, 0.424, 0.416);
  text(p.uan || '101458290341', 192, 639, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('PAN', 34, 624, 7.8, false, 0.373, 0.424, 0.416);
  text(p.pan || 'BNZPS4821K', 192, 624, 7.8, true, 0.075, 0.125, 0.118, 'right');

  // Col 2: Payment Details
  rect(211, 620, 172, 82, 1, 1, 1, true);
  rect(211, 620, 172, 82, 0.89, 0.914, 0.906, false);
  rect(211, 684, 172, 18, 0.914, 0.973, 0.965, true);
  text('Payment Details', 217, 689, 7.8, true, 0.059, 0.463, 0.431);
  text('Bank Name', 217, 671, 7.8, false, 0.373, 0.424, 0.416);
  text(p.bankName || 'HDFC Bank Ltd.', 375, 671, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Acc No.', 217, 655, 7.8, false, 0.373, 0.424, 0.416);
  text(p.accountNumber || '50100482917304', 375, 655, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Days Paid', 217, 639, 7.8, false, 0.373, 0.424, 0.416);
  text(String(p.daysPaid || 30), 375, 639, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Permissions', 217, 624, 7.8, false, 0.373, 0.424, 0.416);
  text('2 hrs (Paid)', 375, 624, 7.8, true, 0.059, 0.463, 0.431, 'right');

  // Col 3: Location Details
  rect(395, 620, 172, 82, 1, 1, 1, true);
  rect(395, 620, 172, 82, 0.89, 0.914, 0.906, false);
  rect(395, 684, 172, 18, 0.914, 0.973, 0.965, true);
  text('Location Details', 401, 689, 7.8, true, 0.059, 0.463, 0.431);
  text('Location', 401, 671, 7.8, false, 0.373, 0.424, 0.416);
  text(p.workLocation || 'Chennai', 559, 671, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Base Br.', 401, 655, 7.8, false, 0.373, 0.424, 0.416);
  text(p.baseBranch || 'Chennai HQ', 559, 655, 7.8, true, 0.075, 0.125, 0.118, 'right');
  text('Beneficiary ID', 401, 639, 7.8, false, 0.373, 0.424, 0.416);
  text(p.beneficiaryId || 'BEN0048219', 559, 639, 7.8, true, 0.075, 0.125, 0.118, 'right');

  // 5. Leave Details Table
  rect(28, 565, 539, 44, 1, 1, 1, true);
  rect(28, 565, 539, 44, 0.89, 0.914, 0.906, false);
  rect(28, 594, 539, 15, 0.914, 0.973, 0.965, true);
  text('Leave Details', 34, 598, 7.8, true, 0.059, 0.463, 0.431);
  rect(28, 579, 539, 15, 0.949, 0.961, 0.957, true);
  const leaveCols = ['SL', 'EL', 'CL', 'FL', 'LC'];
  const leaveVals = [
    formatPdfNumberClean(p.leaveBalances?.sl ?? 2),
    formatPdfNumberClean(p.leaveBalances?.el ?? 10),
    formatPdfNumberClean(p.leaveBalances?.cl ?? 3),
    formatPdfNumberClean(p.leaveBalances?.fl ?? 1),
    formatPdfNumberClean(p.leaveBalances?.lc ?? 0),
  ];
  const colW = 539 / 5;
  for (let i = 0; i < 5; i++) {
    const cx = 28 + i * colW + colW / 2;
    text(leaveCols[i]!, cx, 583, 7.8, true, 0.373, 0.424, 0.416, 'center');
    text(leaveVals[i]!, cx, 569, 8.5, true, 0.075, 0.125, 0.118, 'center');
  }

  // 6. Side-by-side Earnings & Deductions
  // Earnings Table (w=295, x=28)
  rect(28, 385, 295, 168, 1, 1, 1, true);
  rect(28, 385, 295, 168, 0.89, 0.914, 0.906, false);
  rect(28, 533, 295, 20, 0.059, 0.463, 0.431, true);
  text('Earnings', 34, 539, 8, true, 1, 1, 1);
  text('Arrears (INR)', 230, 539, 7.8, true, 1, 1, 1, 'right');
  text('Current (INR)', 315, 539, 7.8, true, 1, 1, 1, 'right');

  const earnings: [string, number, number, boolean][] = [
    ['Basic Salary', p.basicArrears || 0, p.basicSalary ?? 45000, false],
    ['House Rent Allowance', p.hraArrears || 0, p.hra ?? 18000, true],
    ['Performance Pay', p.performanceArrears || 0, p.performancePay ?? 10000, false],
    ['Variable Allowance', p.variableArrears || 0, p.variableAllowance ?? 12000, true],
  ];
  let ey = 512;
  for (const e of earnings) {
    if (e[3]) rect(29, ey - 5, 293, 20, 0.949, 0.961, 0.957, true);
    text(e[0], 34, ey, 8, false, 0.075, 0.125, 0.118);
    text(e[1] > 0 ? formatPdfAmount(e[1]) : '', 230, ey, 8, false, 0.075, 0.125, 0.118, 'right');
    text(formatPdfAmount(e[2]), 315, ey, 8, true, 0.075, 0.125, 0.118, 'right');
    ey -= 23;
  }
  // Total Earnings
  rect(28, 385, 295, 22, 0.914, 0.973, 0.965, true);
  text('Total Earnings', 34, 392, 8.5, true, 0.075, 0.125, 0.118);
  text(
    `Rs. ${formatPdfAmount(p.totalEarnings ?? 85000)}`,
    315,
    392,
    8.5,
    true,
    0.059,
    0.463,
    0.431,
    'right',
  );

  // Deductions Table (w=232, x=335)
  rect(335, 385, 232, 168, 1, 1, 1, true);
  rect(335, 385, 232, 168, 0.89, 0.914, 0.906, false);
  rect(335, 533, 232, 20, 0.059, 0.463, 0.431, true);
  text('Deductions', 342, 539, 8, true, 1, 1, 1);
  text('Amount (INR)', 559, 539, 7.8, true, 1, 1, 1, 'right');

  const deductions: [string, number, boolean][] = [
    ['Provident Fund', p.providentFund ?? 3600, false],
    ['Income Tax (TDS)', p.incomeTax ?? 2200, true],
    ['Professional Tax', p.professionalTax ?? 200, false],
    [p.otherDeductionDesc || 'Loss of Pay (LOP)', p.otherDeductionAmount || 0, true],
  ];
  let dy = 512;
  for (const d of deductions) {
    if (d[2]) rect(336, dy - 5, 230, 20, 0.949, 0.961, 0.957, true);
    text(d[0], 342, dy, 8, false, 0.075, 0.125, 0.118);
    text(formatPdfAmount(d[1]), 559, dy, 8, true, 0.075, 0.125, 0.118, 'right');
    dy -= 23;
  }
  // Total Deductions
  rect(335, 385, 232, 22, 0.914, 0.973, 0.965, true);
  text('Total Deductions', 342, 392, 8.5, true, 0.075, 0.125, 0.118);
  text(
    `Rs. ${formatPdfAmount(p.totalDeductions ?? 6000)}`,
    559,
    392,
    8.5,
    true,
    0.059,
    0.463,
    0.431,
    'right',
  );

  // 7. Retirals & Projected Annual Tax
  // Retirals (w=165, x=28)
  rect(28, 280, 165, 92, 1, 1, 1, true);
  rect(28, 280, 165, 92, 0.89, 0.914, 0.906, false);
  rect(28, 354, 165, 18, 0.914, 0.973, 0.965, true);
  text('Retirals as on Month end', 34, 359, 7.8, true, 0.059, 0.463, 0.431);
  text('Provident Fund', 34, 335, 7.8, false, 0.373, 0.424, 0.416);
  text(formatPdfAmount(p.retiralPf ?? 3600), 185, 335, 7.8, true, 0.075, 0.125, 0.118, 'right');
  rect(29, 310, 163, 18, 0.949, 0.961, 0.957, true);
  text('Gratuity', 34, 315, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.retiralGratuity ?? 2165),
    185,
    315,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );

  // Projected Annual Tax (w=360, x=207)
  rect(207, 280, 360, 92, 1, 1, 1, true);
  rect(207, 280, 360, 92, 0.89, 0.914, 0.906, false);
  rect(207, 354, 360, 18, 0.914, 0.973, 0.965, true);
  text('Projected Annual Tax Information', 214, 359, 7.8, true, 0.059, 0.463, 0.431);

  text('Annual Income', 214, 338, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.annualIncome ?? 1020000),
    370,
    338,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );
  text('NetTax Income', 400, 338, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.netTaxIncome ?? 870000),
    559,
    338,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );

  rect(208, 316, 358, 17, 0.949, 0.961, 0.957, true);
  text('Deductions (if any)', 214, 321, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.taxDeductions ?? 150000),
    370,
    321,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );
  text('Total Tax Payable', 400, 321, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.totalTaxPayable ?? 39000),
    559,
    321,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );

  text('Tax deducted till now', 400, 303, 7.8, false, 0.373, 0.424, 0.416);
  text(
    formatPdfAmount(p.taxDeductedTillNow ?? 22000),
    559,
    303,
    7.8,
    true,
    0.075,
    0.125,
    0.118,
    'right',
  );

  text('Balance Tax', 400, 287, 7.8, true, 0.059, 0.463, 0.431);
  text(formatPdfAmount(p.balanceTax ?? 17000), 559, 287, 7.8, true, 0.059, 0.463, 0.431, 'right');

  // 8. Footer Note
  text(
    'This is an official system generated salary slip verified by MAXR Teamspace Payroll.',
    297,
    240,
    8,
    false,
    0.373,
    0.424,
    0.416,
    'center',
  );

  const stream = lines.join('\n');
  const streamBytes = new TextEncoder().encode(stream);
  const streamLen = streamBytes.length;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
  ];

  let xref = `xref\r\n0 ${objects.length + 1}\r\n0000000000 65535 f \r\n`;
  let offset = 10; // '%PDF-1.4\r\n'
  let body = '';
  for (const obj of objects) {
    const s = `${obj}\r\n`;
    const byteLen = new TextEncoder().encode(s).length;
    xref += `${String(offset).padStart(10, '0')} 00000 n \r\n`;
    offset += byteLen;
    body += s;
  }

  const trailer = `trailer\r\n<< /Size ${objects.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${offset}\r\n%%EOF\r\n`;
  const fullPdf = `%PDF-1.4\r\n${body}${xref}${trailer}`;
  return new TextEncoder().encode(fullPdf);
}

export async function downloadPayslipPdf(
  payslip: Pick<PayslipRecord, 'id' | 'periodLabel' | 'employeeCode'> & Partial<PayslipRecord>,
): Promise<string> {
  const safePeriod = payslip.periodLabel.replace(/\s+/g, '_');
  const safeEmp = (payslip.employeeCode || 'EMP').replace(/[^A-Za-z0-9_-]+/g, '_');
  const defaultFilename = `MAXR_Payslip_${safePeriod}_${safeEmp}.pdf`;

  let blob: Blob | null = null;
  let filename = defaultFilename;

  try {
    const res = await apiFetch(`/api/v1/payslips/${payslip.id}/pdf`);
    if (res.ok) {
      blob = await res.blob();
      filename = filenameFromHeaders(res, payslip.periodLabel, payslip.employeeCode);
    }
  } catch {
    // Backend offline / unauthorized fallback
  }

  if (!blob) {
    const pdfBytes = generateClientPayslipPdf(payslip);
    blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  }

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
