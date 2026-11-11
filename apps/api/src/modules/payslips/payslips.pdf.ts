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

const BLUE_HEADER = '#1F63C6';
const BLACK_BORDER = '#000000';
const MAXR_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 34" width="110" height="34">
  <text x="2" y="25" font-family="Inter, Helvetica, Arial, sans-serif" font-size="25" font-weight="700" fill="#111827" letter-spacing="-1">maxr</text>
  <circle cx="88" cy="21" r="4.5" fill="#26A65B"/>
</svg>`;

function formatAmount(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumberClean(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const boxTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0,
  vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
    i === 0 || i === node.table.widths.length ? 0.7 : 0,
  hLineColor: () => BLACK_BORDER,
  vLineColor: () => BLACK_BORDER,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const gridTableLayout = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => BLACK_BORDER,
  vLineColor: () => BLACK_BORDER,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
};

const totalBoxTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length
      ? 0.7
      : 0,
  vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
    i === 0 || i === node.table.widths.length ? 0.7 : 0,
  hLineColor: () => BLACK_BORDER,
  vLineColor: () => BLACK_BORDER,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
};

function kvRow(label: string, value: string) {
  return [
    { text: label, fontSize: 7.5, color: '#222222', margin: [0, 1, 0, 1] },
    { text: value || '—', fontSize: 7.5, bold: true, color: '#000000', margin: [0, 1, 0, 1] },
  ];
}

function earningRow(label: string, arrears: number, current: number) {
  return [
    { text: label, fontSize: 7.8, color: '#111111' },
    { text: formatAmount(arrears), fontSize: 7.8, alignment: 'right' },
    { text: formatAmount(current), fontSize: 7.8, alignment: 'right' },
  ];
}

function deductionRow(label: string, amount: number) {
  return [
    { text: label, fontSize: 7.8, color: '#111111' },
    { text: formatAmount(amount), fontSize: 7.8, alignment: 'right' },
  ];
}

/**
 * Generates an exact single-page A4 portrait Payslip PDF matching the MAXR reference layout.
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
  const totalRetirals = payslip.retiralPf + payslip.retiralGratuity;

  const leave = payslip.leaveBalances;

  const definition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [24, 22, 24, 20],
    defaultStyle: { font: 'Inter', fontSize: 8, color: '#000000' },
    info: {
      title: `Payslip - ${payslip.periodLabel} - ${payslip.employeeCode}`,
      creator: 'MAXR Teamspace',
    },
    content: [
      // 1. Top Header: Payslip + Month/Year on left, MAXR logo on right
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Payslip', fontSize: 12, bold: true, color: '#000000' },
              {
                text: payslip.periodLabel,
                fontSize: 10,
                bold: true,
                color: '#111827',
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            width: 105,
            alignment: 'right',
            svg: MAXR_LOGO_SVG,
            fit: [96, 30],
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // 2. Employee Name Banner Line
      {
        text: payslip.employeeName.toUpperCase(),
        fontSize: 9.5,
        bold: true,
        color: '#000000',
        margin: [0, 0, 0, 5],
      },

      // 3. Employee Details | Payment & Leave Details | Location Details (3 side-by-side panels)
      {
        table: {
          widths: ['34%', '36%', '30%'],
          dontBreakRows: true,
          body: [
            [
              {
                text: 'Employee Details',
                fillColor: BLUE_HEADER,
                color: '#FFFFFF',
                bold: true,
                fontSize: 8.5,
              },
              {
                text: 'Payment & Leave Details',
                fillColor: BLUE_HEADER,
                color: '#FFFFFF',
                bold: true,
                fontSize: 8.5,
              },
              {
                text: 'Location Details',
                fillColor: BLUE_HEADER,
                color: '#FFFFFF',
                bold: true,
                fontSize: 8.5,
              },
            ],
            [
              {
                table: {
                  widths: [58, '*'],
                  body: [
                    kvRow('Emp No', payslip.employeeCode),
                    kvRow('Designation', payslip.designation),
                    kvRow('UAN', payslip.uan),
                    kvRow('PAN', payslip.pan),
                  ],
                },
                layout: 'noBorders',
              },
              {
                stack: [
                  {
                    table: {
                      widths: [56, '*'],
                      body: [
                        kvRow('Bank Name', payslip.bankName),
                        kvRow('Acc No.', payslip.accountNumber),
                        kvRow('Days Paid', formatNumberClean(payslip.daysPaid)),
                      ],
                    },
                    layout: 'noBorders',
                  },
                  {
                    margin: [0, 5, 0, 0],
                    table: {
                      widths: ['*', 26, 26, 26, 26, 26],
                      body: [
                        [
                          { text: 'Leave', fontSize: 7, bold: true },
                          { text: 'SL', fontSize: 7, bold: true, alignment: 'center' },
                          { text: 'EL', fontSize: 7, bold: true, alignment: 'center' },
                          { text: 'CL', fontSize: 7, bold: true, alignment: 'center' },
                          { text: 'FL', fontSize: 7, bold: true, alignment: 'center' },
                          { text: 'LC', fontSize: 7, bold: true, alignment: 'center' },
                        ],
                        [
                          { text: 'Balance', fontSize: 7 },
                          { text: formatNumberClean(leave.sl), fontSize: 7, alignment: 'center' },
                          { text: formatNumberClean(leave.el), fontSize: 7, alignment: 'center' },
                          { text: formatNumberClean(leave.cl), fontSize: 7, alignment: 'center' },
                          { text: formatNumberClean(leave.fl), fontSize: 7, alignment: 'center' },
                          { text: formatNumberClean(leave.lc), fontSize: 7, alignment: 'center' },
                        ],
                      ],
                    },
                    layout: {
                      hLineWidth: () => 0.5,
                      vLineWidth: () => 0.5,
                      hLineColor: () => '#666666',
                      vLineColor: () => '#666666',
                      paddingLeft: () => 2,
                      paddingRight: () => 2,
                      paddingTop: () => 1.5,
                      paddingBottom: () => 1.5,
                    },
                  },
                ],
              },
              {
                table: {
                  widths: [62, '*'],
                  body: [
                    kvRow('Location', payslip.workLocation),
                    kvRow('Base Br.', payslip.baseBranch),
                    kvRow('Location', payslip.subLocation || payslip.workLocation),
                    kvRow('Beneficiary ID', payslip.beneficiaryId),
                  ],
                },
                layout: 'noBorders',
              },
            ],
          ],
        },
        layout: gridTableLayout,
        margin: [0, 0, 0, 10],
      },

      // 4. Side-by-side Earnings & Deductions tables
      {
        columns: [
          {
            width: '55%',
            table: {
              widths: ['*', 62, 66],
              heights: (_row: number) => (_row === 5 ? 165 : undefined),
              body: [
                [
                  {
                    text: 'Earnings Description',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                  },
                  {
                    text: 'Arrears (INR)',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                  },
                  {
                    text: 'Current (INR)',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                  },
                ],
                earningRow('Basic Salary', payslip.basicArrears, payslip.basicSalary),
                earningRow('House Rent Allowance', payslip.hraArrears, payslip.hra),
                earningRow('Performance Pay', payslip.performanceArrears, payslip.performancePay),
                earningRow(
                  'Variable Allowance',
                  payslip.variableArrears,
                  payslip.variableAllowance,
                ),
                [{ text: '' }, { text: '' }, { text: '' }],
                [
                  { text: 'Total Earnings', bold: true, fontSize: 8.2 },
                  {
                    text: formatAmount(totalArrears),
                    bold: true,
                    fontSize: 8.2,
                    alignment: 'right',
                  },
                  {
                    text: formatAmount(totalEarnings),
                    bold: true,
                    fontSize: 8.2,
                    alignment: 'right',
                  },
                ],
              ],
            },
            layout: totalBoxTableLayout,
          },
          { width: 10, text: '' },
          {
            width: '*',
            table: {
              widths: ['*', 72],
              heights: (_row: number) => (_row === 5 ? 165 : undefined),
              body: [
                [
                  {
                    text: 'Deductions',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                  },
                  {
                    text: 'Amount',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                  },
                ],
                deductionRow('Provident Fund', payslip.providentFund),
                deductionRow('Income Tax', payslip.incomeTax),
                deductionRow('Professional Tax', payslip.professionalTax),
                deductionRow(
                  payslip.otherDeductionDesc || 'Other Deductions',
                  payslip.otherDeductionAmount,
                ),
                [{ text: '' }, { text: '' }],
                [
                  { text: 'Total Deductions', bold: true, fontSize: 8.2 },
                  {
                    text: formatAmount(totalDeductions),
                    bold: true,
                    fontSize: 8.2,
                    alignment: 'right',
                  },
                ],
              ],
            },
            layout: totalBoxTableLayout,
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // 5. Retirals & Net Pay (INR) side-by-side
      {
        columns: [
          {
            width: '55%',
            table: {
              widths: ['*', 72],
              body: [
                [
                  {
                    text: 'Retirals as on Month end',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                  },
                  {
                    text: 'Amount',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 8.5,
                    alignment: 'right',
                  },
                ],
                deductionRow('Provident Fund', payslip.retiralPf),
                deductionRow('Gratuity', payslip.retiralGratuity),
                [
                  { text: 'Total Retirals', bold: true, fontSize: 8 },
                  {
                    text: formatAmount(totalRetirals),
                    bold: true,
                    fontSize: 8,
                    alignment: 'right',
                  },
                ],
              ],
            },
            layout: boxTableLayout,
          },
          { width: 10, text: '' },
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: 'Net Pay (INR)',
                    fillColor: BLUE_HEADER,
                    color: '#FFFFFF',
                    bold: true,
                    fontSize: 9.5,
                  },
                ],
                [
                  {
                    text: formatAmount(netPay),
                    bold: true,
                    fontSize: 13.5,
                    alignment: 'right',
                    margin: [0, 12, 4, 12],
                    color: '#000000',
                  },
                ],
              ],
            },
            layout: gridTableLayout,
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // 6. Projected Annual Tax Information (full-width bordered box)
      {
        table: {
          widths: ['18%', '15%', '20%', '14%', '18%', '15%'],
          body: [
            [
              {
                text: 'Projected Annual Tax Information',
                colSpan: 6,
                fillColor: BLUE_HEADER,
                color: '#FFFFFF',
                bold: true,
                fontSize: 8.5,
              },
              {},
              {},
              {},
              {},
              {},
            ],
            [
              { text: 'Annual Income', fontSize: 7.5 },
              {
                text: formatAmount(payslip.annualIncome),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
              { text: 'Deductions (if any)', fontSize: 7.5 },
              {
                text: formatAmount(payslip.taxDeductions),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
              { text: 'NetTax Income', fontSize: 7.5 },
              {
                text: formatAmount(payslip.netTaxIncome),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
            ],
            [
              { text: 'Total Tax Payable', fontSize: 7.5 },
              {
                text: formatAmount(payslip.totalTaxPayable),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
              { text: 'Tax deducted till now', fontSize: 7.5 },
              {
                text: formatAmount(payslip.taxDeductedTillNow),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
              { text: 'Balance Tax', fontSize: 7.5 },
              {
                text: formatAmount(payslip.balanceTax),
                fontSize: 7.5,
                bold: true,
                alignment: 'right',
              },
            ],
          ],
        },
        layout: gridTableLayout,
        margin: [0, 0, 0, 14],
      },

      // 7. System note
      {
        text: 'Note: This is a system-generated payslip and does not require a physical signature.',
        fontSize: 7.5,
        color: '#4B5563',
      },
    ],
  };

  const bytes = await pdfmake.createPdf(definition).getBuffer();
  return Buffer.from(bytes);
}
