import fs from 'node:fs';
import path from 'node:path';
import type { PayslipRecord } from './payslips.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake') as {
  setFonts: (fonts: Record<string, Record<string, string>>) => void;
  setUrlAccessPolicy: (fn: () => boolean) => void;
  setLocalAccessPolicy: (fn: (file: string) => boolean) => void;
  createPdf: (definition: unknown) => { getBuffer: () => Promise<Uint8Array> };
};

const fontFile = (pkg: string, file: string) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);

const FONTS = {
  Inter: {
    normal: fontFile('@fontsource/inter', 'inter-latin-400-normal.woff'),
    bold: fontFile('@fontsource/inter', 'inter-latin-700-normal.woff'),
  },
};

const ALLOWED_FILES = new Set(
  Object.values(FONTS).flatMap((family) => Object.values(family).map((f) => path.resolve(f))),
);

let configured = false;
function ensurePdfConfigured() {
  if (configured) return;
  pdfmake.setFonts(FONTS);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file: string) => ALLOWED_FILES.has(path.resolve(file)));
  configured = true;
}

function loadMaxrLogoDataUri(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../web/public/maxr.png'),
    path.resolve(__dirname, '../../../../../apps/web/public/maxr.png'),
    path.resolve(process.cwd(), 'apps/web/public/maxr.png'),
    path.resolve(process.cwd(), '../web/public/maxr.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const base64 = fs.readFileSync(candidate).toString('base64');
      return `data:image/png;base64,${base64}`;
    }
  }
  return null;
}

const MAXR_LOGO_DATA_URI = loadMaxrLogoDataUri();

// MAXR Mint Green & Deep Teal Palette
const MINT_ACCENT = '#46C7B8';
const MINT_SOFT = '#E9F8F6';
const TEAL_DEEP = '#0F766E';
const INK_DARK = '#13201E';
const INK_SUBTLE = '#5F6C6A';
const SURFACE_ALT = '#F2F5F4';
const BORDER_LIGHT = '#E3E9E7';

function formatAmount(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumberClean(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const cardTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === node.table.body.length ? 0.8 : 0.4,
  vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
    i === 0 || i === node.table.widths.length ? 0.8 : 0,
  hLineColor: () => BORDER_LIGHT,
  vLineColor: () => BORDER_LIGHT,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

const infoBlockLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === node.table.body.length ? 0.8 : 0.4,
  vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
    i === 0 || i === node.table.widths.length ? 0.8 : 0,
  hLineColor: () => BORDER_LIGHT,
  vLineColor: () => BORDER_LIGHT,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 5.5,
  paddingBottom: () => 5.5,
};

function infoRow(label: string, value: string) {
  return [
    { text: label, fontSize: 7.8, color: INK_SUBTLE },
    { text: value || '', fontSize: 7.8, bold: true, color: INK_DARK, alignment: 'right' },
  ];
}

function earningRow(label: string, arrears: number, current: number, shaded: boolean) {
  const fillColor = shaded ? SURFACE_ALT : '#FFFFFF';
  return [
    { text: label, fontSize: 8, color: INK_DARK, fillColor },
    {
      text: arrears > 0 ? formatAmount(arrears) : '',
      fontSize: 8,
      alignment: 'right',
      color: INK_DARK,
      fillColor,
    },
    {
      text: formatAmount(current),
      fontSize: 8,
      bold: true,
      alignment: 'right',
      color: INK_DARK,
      fillColor,
    },
  ];
}

function deductionRow(label: string, amount: number, shaded: boolean) {
  const fillColor = shaded ? SURFACE_ALT : '#FFFFFF';
  return [
    { text: label, fontSize: 8, color: INK_DARK, fillColor },
    {
      text: formatAmount(amount),
      fontSize: 8,
      bold: true,
      alignment: 'right',
      color: INK_DARK,
      fillColor,
    },
  ];
}

/**
 * Generates a modern Mint Green single-page A4 portrait Payslip PDF using only the standard MAXR payslip fields.
 */
export async function renderPayslipPdf(payslip: PayslipRecord): Promise<Buffer> {
  ensurePdfConfigured();

  const totalCurrent =
    payslip.basicSalary + payslip.hra + payslip.performancePay + payslip.variableAllowance;
  const totalArrears =
    payslip.basicArrears +
    payslip.hraArrears +
    payslip.performanceArrears +
    payslip.variableArrears;
  const totalEarnings = totalCurrent + totalArrears;
  const totalDeductions =
    payslip.providentFund +
    payslip.incomeTax +
    payslip.professionalTax +
    payslip.otherDeductionAmount;
  const netPay = Math.max(0, totalEarnings - totalDeductions);
  const leave = payslip.leaveBalances;

  const logoCell = MAXR_LOGO_DATA_URI
    ? { image: MAXR_LOGO_DATA_URI, fit: [115, 34], alignment: 'right' }
    : { text: 'maxr.', fontSize: 20, bold: true, alignment: 'right', color: INK_DARK };

  const definition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 22, 28, 24],
    defaultStyle: { font: 'Inter', fontSize: 8.5, color: INK_DARK },
    info: {
      title: `Payslip - ${payslip.periodLabel} - ${payslip.employeeCode}`,
      creator: 'MAXR Teamspace',
    },
    content: [
      // 1. Mint Green Top Accent Bar
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 539, h: 4, color: MINT_ACCENT, r: 2 }],
        margin: [0, 0, 0, 14],
      },

      // 2. Header: Payslip + Period on left, maxr.png logo on right
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Payslip', fontSize: 14, bold: true, color: INK_DARK },
              {
                text: payslip.periodLabel,
                fontSize: 12,
                bold: true,
                color: TEAL_DEEP,
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            width: 130,
            ...logoCell,
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // 3. Mint Banner: Employee Name + Net Pay (INR)
      {
        table: {
          widths: ['*', 175],
          body: [
            [
              {
                fillColor: MINT_SOFT,
                border: [true, true, false, true],
                stack: [
                  {
                    text: payslip.employeeName,
                    fontSize: 12.5,
                    bold: true,
                    color: INK_DARK,
                    margin: [0, 6, 0, 6],
                  },
                ],
                margin: [6, 4, 6, 4],
              },
              {
                fillColor: TEAL_DEEP,
                border: [false, true, true, true],
                stack: [
                  {
                    text: 'Net Pay (INR)',
                    fontSize: 7.8,
                    bold: true,
                    color: MINT_SOFT,
                    alignment: 'right',
                  },
                  {
                    text: formatAmount(netPay),
                    fontSize: 14.5,
                    bold: true,
                    color: '#FFFFFF',
                    alignment: 'right',
                    margin: [0, 2, 0, 0],
                  },
                ],
                margin: [8, 4, 8, 4],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => MINT_ACCENT,
          vLineColor: () => MINT_ACCENT,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 14],
      },

      // 4. Employee Details | Payment Details | Location Details
      {
        columns: [
          {
            width: '32%',
            table: {
              widths: ['42%', '58%'],
              body: [
                [
                  {
                    text: 'Employee Details',
                    colSpan: 2,
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                    bold: true,
                    fontSize: 7.8,
                  },
                  {},
                ],
                infoRow('Emp No', payslip.employeeCode),
                infoRow('Designation', payslip.designation),
                infoRow('UAN', payslip.uan),
                infoRow('PAN', payslip.pan),
              ],
            },
            layout: infoBlockLayout,
          },
          { width: '2%', text: '' },
          {
            width: '34%',
            table: {
              widths: ['40%', '60%'],
              body: [
                [
                  {
                    text: 'Payment Details',
                    colSpan: 2,
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                    bold: true,
                    fontSize: 7.8,
                  },
                  {},
                ],
                infoRow('Bank Name', payslip.bankName),
                infoRow('Acc No.', payslip.accountNumber),
                infoRow(
                  'Days Paid',
                  payslip.daysPaid > 0 ? formatNumberClean(payslip.daysPaid) : '',
                ),
                infoRow(' ', ' '),
              ],
            },
            layout: infoBlockLayout,
          },
          { width: '2%', text: '' },
          {
            width: '30%',
            table: {
              widths: ['46%', '54%'],
              body: [
                [
                  {
                    text: 'Location Details',
                    colSpan: 2,
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                    bold: true,
                    fontSize: 7.8,
                  },
                  {},
                ],
                infoRow('Location', payslip.workLocation),
                infoRow('Base Br.', payslip.baseBranch),
                infoRow('Beneficiary ID', payslip.beneficiaryId),
                infoRow(' ', ' '),
              ],
            },
            layout: infoBlockLayout,
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // 5. Individual Leave Details Table (SL, EL, CL, FL, LC)
      {
        table: {
          widths: ['*', '*', '*', '*', '*'],
          body: [
            [
              {
                text: 'Leave Details',
                colSpan: 5,
                fillColor: MINT_SOFT,
                color: TEAL_DEEP,
                bold: true,
                fontSize: 7.8,
              },
              {},
              {},
              {},
              {},
            ],
            [
              {
                text: 'SL',
                fillColor: SURFACE_ALT,
                color: INK_SUBTLE,
                bold: true,
                fontSize: 7.8,
                alignment: 'center',
              },
              {
                text: 'EL',
                fillColor: SURFACE_ALT,
                color: INK_SUBTLE,
                bold: true,
                fontSize: 7.8,
                alignment: 'center',
              },
              {
                text: 'CL',
                fillColor: SURFACE_ALT,
                color: INK_SUBTLE,
                bold: true,
                fontSize: 7.8,
                alignment: 'center',
              },
              {
                text: 'FL',
                fillColor: SURFACE_ALT,
                color: INK_SUBTLE,
                bold: true,
                fontSize: 7.8,
                alignment: 'center',
              },
              {
                text: 'LC',
                fillColor: SURFACE_ALT,
                color: INK_SUBTLE,
                bold: true,
                fontSize: 7.8,
                alignment: 'center',
              },
            ],
            [
              {
                text: formatNumberClean(leave.sl),
                bold: true,
                fontSize: 9,
                color: INK_DARK,
                alignment: 'center',
              },
              {
                text: formatNumberClean(leave.el),
                bold: true,
                fontSize: 9,
                color: INK_DARK,
                alignment: 'center',
              },
              {
                text: formatNumberClean(leave.cl),
                bold: true,
                fontSize: 9,
                color: INK_DARK,
                alignment: 'center',
              },
              {
                text: formatNumberClean(leave.fl),
                bold: true,
                fontSize: 9,
                color: INK_DARK,
                alignment: 'center',
              },
              {
                text: formatNumberClean(leave.lc),
                bold: true,
                fontSize: 9,
                color: INK_DARK,
                alignment: 'center',
              },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === node.table.body.length ? 0.8 : 0.4,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER_LIGHT,
          vLineColor: () => BORDER_LIGHT,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 14],
      },

      // 6. Side-by-side Earnings & Deductions (spaced to fill A4 cleanly)
      {
        columns: [
          {
            width: '55%',
            table: {
              widths: ['*', 58, 66],
              heights: (rowIndex: number) => (rowIndex === 5 ? 145 : undefined),
              body: [
                [
                  {
                    text: 'Earnings',
                    fillColor: TEAL_DEEP,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8,
                  },
                  {
                    text: 'Arrears (INR)',
                    fillColor: TEAL_DEEP,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 7.8,
                    alignment: 'right',
                  },
                  {
                    text: 'Current (INR)',
                    fillColor: TEAL_DEEP,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 7.8,
                    alignment: 'right',
                  },
                ],
                earningRow('Basic Salary', payslip.basicArrears, payslip.basicSalary, false),
                earningRow('House Rent Allowance', payslip.hraArrears, payslip.hra, true),
                earningRow(
                  'Performance Pay',
                  payslip.performanceArrears,
                  payslip.performancePay,
                  false,
                ),
                earningRow(
                  'Variable Allowance',
                  payslip.variableArrears,
                  payslip.variableAllowance,
                  true,
                ),
                [
                  { text: ' ', fillColor: '#FFFFFF' },
                  { text: ' ', fillColor: '#FFFFFF' },
                  { text: ' ', fillColor: '#FFFFFF' },
                ],
                [
                  { text: 'Total Earnings', bold: true, fontSize: 8.5, fillColor: MINT_SOFT },
                  {
                    text: totalArrears > 0 ? formatAmount(totalArrears) : '',
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                    fillColor: MINT_SOFT,
                    color: INK_DARK,
                  },
                  {
                    text: formatAmount(totalEarnings),
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                  },
                ],
              ],
            },
            layout: cardTableLayout,
          },
          { width: '3%', text: '' },
          {
            width: '42%',
            table: {
              widths: ['*', 76],
              heights: (rowIndex: number) => (rowIndex === 5 ? 145 : undefined),
              body: [
                [
                  {
                    text: 'Deductions',
                    fillColor: TEAL_DEEP,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8,
                  },
                  {
                    text: 'Amount',
                    fillColor: TEAL_DEEP,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 7.8,
                    alignment: 'right',
                  },
                ],
                deductionRow('Provident Fund', payslip.providentFund, false),
                deductionRow('Income Tax', payslip.incomeTax, true),
                deductionRow('Professional Tax', payslip.professionalTax, false),
                deductionRow(
                  payslip.otherDeductionDesc || 'Desc.',
                  payslip.otherDeductionAmount,
                  true,
                ),
                [
                  { text: ' ', fillColor: '#FFFFFF' },
                  { text: ' ', fillColor: '#FFFFFF' },
                ],
                [
                  { text: 'Total Deductions', bold: true, fontSize: 8.5, fillColor: MINT_SOFT },
                  {
                    text: formatAmount(totalDeductions),
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                  },
                ],
              ],
            },
            layout: cardTableLayout,
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // 7. Retirals as on Month end & Projected Annual Tax Information
      {
        columns: [
          {
            width: '30%',
            table: {
              widths: ['*', 58],
              body: [
                [
                  {
                    text: 'Retirals as on Month end',
                    colSpan: 2,
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                    bold: true,
                    fontSize: 7.8,
                  },
                  {},
                ],
                deductionRow('Provident Fund', payslip.retiralPf, false),
                deductionRow('Gratuity', payslip.retiralGratuity, true),
              ],
            },
            layout: cardTableLayout,
          },
          { width: '3%', text: '' },
          {
            width: '67%',
            table: {
              widths: ['*', 68, '*', 68],
              body: [
                [
                  {
                    text: 'Projected Annual Tax Information',
                    colSpan: 4,
                    fillColor: MINT_SOFT,
                    color: TEAL_DEEP,
                    bold: true,
                    fontSize: 7.8,
                  },
                  {},
                  {},
                  {},
                ],
                [
                  { text: 'Annual Income', fontSize: 7.8, color: INK_SUBTLE },
                  {
                    text: formatAmount(payslip.annualIncome),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                  },
                  { text: 'NetTax Income', fontSize: 7.8, color: INK_SUBTLE },
                  {
                    text: formatAmount(payslip.netTaxIncome),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                  },
                ],
                [
                  {
                    text: 'Deductions (if any)',
                    fontSize: 7.8,
                    color: INK_SUBTLE,
                    fillColor: SURFACE_ALT,
                  },
                  {
                    text: formatAmount(payslip.taxDeductions),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                    fillColor: SURFACE_ALT,
                  },
                  {
                    text: 'Total Tax Payable',
                    fontSize: 7.8,
                    color: INK_SUBTLE,
                    fillColor: SURFACE_ALT,
                  },
                  {
                    text: formatAmount(payslip.totalTaxPayable),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                    fillColor: SURFACE_ALT,
                  },
                ],
                [
                  { text: '', fillColor: '#FFFFFF' },
                  { text: '', fillColor: '#FFFFFF' },
                  { text: 'Tax deducted till now', fontSize: 7.8, color: INK_SUBTLE },
                  {
                    text: formatAmount(payslip.taxDeductedTillNow),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                  },
                ],
                [
                  { text: '', fillColor: '#FFFFFF' },
                  { text: '', fillColor: '#FFFFFF' },
                  { text: 'Balance Tax', fontSize: 7.8, bold: true, color: TEAL_DEEP },
                  {
                    text: formatAmount(payslip.balanceTax),
                    fontSize: 7.8,
                    bold: true,
                    alignment: 'right',
                    color: TEAL_DEEP,
                  },
                ],
              ],
            },
            layout: cardTableLayout,
          },
        ],
      },
    ],
  };

  const bytes = await pdfmake.createPdf(definition).getBuffer();
  return Buffer.from(bytes);
}
