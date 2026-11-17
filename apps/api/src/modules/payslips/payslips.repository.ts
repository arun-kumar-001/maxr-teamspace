import type { Pool } from 'pg';
import { conflict, notFound } from '../../http/errors';
import {
  formatPayslipPeriod,
  type ListPayslipsFilter,
  type PayslipRecord,
  type PayslipStatus,
  type UpsertPayslipDto,
} from './payslips.types';

export interface IPayslipsRepository {
  listMine(
    employeeId: string,
    filter: ListPayslipsFilter,
  ): Promise<{ items: PayslipRecord[]; total: number }>;
  listAll(filter: ListPayslipsFilter): Promise<{ items: PayslipRecord[]; total: number }>;
  findById(id: string): Promise<PayslipRecord | null>;
  findByIdForEmployee(id: string, employeeId: string): Promise<PayslipRecord | null>;
  create(dto: UpsertPayslipDto, actorEmployeeId?: string): Promise<PayslipRecord>;
  update(id: string, dto: Partial<UpsertPayslipDto>): Promise<PayslipRecord | null>;
  publish(id: string, actorEmployeeId?: string): Promise<PayslipRecord | null>;
}

interface PayslipDbRow {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string | null;
  pay_month: number;
  pay_year: number;
  status: string;
  published_at: Date | string | null;
  published_by_employee_id: string | null;
  employee_display_name: string;
  emp_no: string;
  designation: string;
  uan: string;
  pan: string;
  bank_name: string;
  account_number: string;
  days_paid: string | number;
  leave_sl: string | number;
  leave_el: string | number;
  leave_cl: string | number;
  leave_fl: string | number;
  leave_lc: string | number;
  location: string;
  base_branch: string;
  work_location: string;
  beneficiary_id: string;
  basic_arrears_paise: string | number;
  basic_current_paise: string | number;
  hra_arrears_paise: string | number;
  hra_current_paise: string | number;
  performance_arrears_paise: string | number;
  performance_current_paise: string | number;
  variable_arrears_paise: string | number;
  variable_current_paise: string | number;
  pf_deduction_paise: string | number;
  income_tax_paise: string | number;
  professional_tax_paise: string | number;
  other_deduction_label: string;
  other_deduction_paise: string | number;
  retiral_pf_paise: string | number;
  retiral_gratuity_paise: string | number;
  annual_income_paise: string | number;
  annual_deductions_paise: string | number;
  net_taxable_income_paise: string | number;
  total_tax_payable_paise: string | number;
  tax_deducted_till_now_paise: string | number;
  balance_tax_paise: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const parsed = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

const paiseToInr = (paise: string | number | null | undefined): number => num(paise) / 100;
const inrToPaise = (inr: number | undefined): number => Math.round((inr ?? 0) * 100);

const iso = (v: Date | string | null): string | null => {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
};

function toPayslipRecord(row: PayslipDbRow): PayslipRecord {
  const basicSalary = paiseToInr(row.basic_current_paise);
  const basicArrears = paiseToInr(row.basic_arrears_paise);
  const hra = paiseToInr(row.hra_current_paise);
  const hraArrears = paiseToInr(row.hra_arrears_paise);
  const performancePay = paiseToInr(row.performance_current_paise);
  const performanceArrears = paiseToInr(row.performance_arrears_paise);
  const variableAllowance = paiseToInr(row.variable_current_paise);
  const variableArrears = paiseToInr(row.variable_arrears_paise);

  const totalCurrentEarnings = basicSalary + hra + performancePay + variableAllowance;
  const totalArrearsEarnings = basicArrears + hraArrears + performanceArrears + variableArrears;
  const totalEarnings = totalCurrentEarnings + totalArrearsEarnings;

  const providentFund = paiseToInr(row.pf_deduction_paise);
  const incomeTax = paiseToInr(row.income_tax_paise);
  const professionalTax = paiseToInr(row.professional_tax_paise);
  const otherDeductionAmount = paiseToInr(row.other_deduction_paise);
  const totalDeductions = providentFund + incomeTax + professionalTax + otherDeductionAmount;
  const netPay = Math.max(0, totalEarnings - totalDeductions);

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.emp_no || row.employee_code,
    employeeName: row.employee_display_name || row.employee_name,
    departmentName: row.department_name,
    payMonth: Number(row.pay_month),
    payYear: Number(row.pay_year),
    periodLabel: formatPayslipPeriod(Number(row.pay_month), Number(row.pay_year)),
    status: row.status as PayslipStatus,
    designation: row.designation,
    uan: row.uan,
    pan: row.pan,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    beneficiaryId: row.beneficiary_id,
    workLocation: row.location || row.work_location,
    baseBranch: row.base_branch,
    subLocation: row.work_location || row.location,
    daysPaid: num(row.days_paid),
    leaveBalances: {
      sl: num(row.leave_sl),
      el: num(row.leave_el),
      cl: num(row.leave_cl),
      fl: num(row.leave_fl),
      lc: num(row.leave_lc),
    },
    basicSalary,
    basicArrears,
    hra,
    hraArrears,
    performancePay,
    performanceArrears,
    variableAllowance,
    variableArrears,
    totalCurrentEarnings,
    totalArrearsEarnings,
    totalEarnings,
    providentFund,
    incomeTax,
    professionalTax,
    otherDeductionDesc: row.other_deduction_label,
    otherDeductionAmount,
    totalDeductions,
    netPay,
    retiralPf: paiseToInr(row.retiral_pf_paise),
    retiralGratuity: paiseToInr(row.retiral_gratuity_paise),
    annualIncome: paiseToInr(row.annual_income_paise),
    taxDeductions: paiseToInr(row.annual_deductions_paise),
    netTaxIncome: paiseToInr(row.net_taxable_income_paise),
    totalTaxPayable: paiseToInr(row.total_tax_payable_paise),
    taxDeductedTillNow: paiseToInr(row.tax_deducted_till_now_paise),
    balanceTax: paiseToInr(row.balance_tax_paise),
    publishedAt: iso(row.published_at),
    publishedBy: row.published_by_employee_id ?? null,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

const SELECT_PAYSLIP = `
  SELECT
    p.id,
    p.employee_id,
    e.employee_code,
    TRIM(e.first_name || ' ' || e.last_name) AS employee_name,
    dept.name AS department_name,
    p.pay_month,
    p.pay_year,
    p.status,
    p.published_at,
    p.published_by_employee_id,
    p.employee_display_name,
    p.emp_no,
    CASE WHEN p.designation <> '' THEN p.designation ELSE COALESCE(desig.title, '') END AS designation,
    p.uan,
    p.pan,
    p.bank_name,
    p.account_number,
    p.days_paid,
    p.leave_sl,
    p.leave_el,
    p.leave_cl,
    p.leave_fl,
    p.leave_lc,
    p.location,
    p.base_branch,
    p.work_location,
    p.beneficiary_id,
    p.basic_arrears_paise,
    p.basic_current_paise,
    p.hra_arrears_paise,
    p.hra_current_paise,
    p.performance_arrears_paise,
    p.performance_current_paise,
    p.variable_arrears_paise,
    p.variable_current_paise,
    p.pf_deduction_paise,
    p.income_tax_paise,
    p.professional_tax_paise,
    p.other_deduction_label,
    p.other_deduction_paise,
    p.retiral_pf_paise,
    p.retiral_gratuity_paise,
    p.annual_income_paise,
    p.annual_deductions_paise,
    p.net_taxable_income_paise,
    p.total_tax_payable_paise,
    p.tax_deducted_till_now_paise,
    p.balance_tax_paise,
    p.created_at,
    p.updated_at
  FROM payslips p
  JOIN employees e ON e.id = p.employee_id
  LEFT JOIN departments dept ON dept.id = e.department_id
  LEFT JOIN designations desig ON desig.id = e.designation_id
`;

export class PgPayslipsRepository implements IPayslipsRepository {
  constructor(private readonly getPool: () => Pool) {}

  async listMine(
    employeeId: string,
    filter: ListPayslipsFilter,
  ): Promise<{ items: PayslipRecord[]; total: number }> {
    const conditions = ['p.employee_id = $1', `p.status = 'published'`];
    const values: unknown[] = [employeeId];
    let idx = 2;

    if (filter.payMonth !== undefined) {
      conditions.push(`p.pay_month = $${idx++}`);
      values.push(filter.payMonth);
    }
    if (filter.payYear !== undefined) {
      conditions.push(`p.pay_year = $${idx++}`);
      values.push(filter.payYear);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (filter.page - 1) * filter.pageSize;

    const countRes = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM payslips p ${where}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const rowsRes = await this.getPool().query<PayslipDbRow>(
      `${SELECT_PAYSLIP} ${where}
       ORDER BY p.pay_year DESC, p.pay_month DESC, p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, filter.pageSize, offset],
    );

    return { items: rowsRes.rows.map(toPayslipRecord), total };
  }

  async listAll(filter: ListPayslipsFilter): Promise<{ items: PayslipRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.employeeId) {
      conditions.push(`p.employee_id = $${idx++}`);
      values.push(filter.employeeId);
    }
    if (filter.payMonth !== undefined) {
      conditions.push(`p.pay_month = $${idx++}`);
      values.push(filter.payMonth);
    }
    if (filter.payYear !== undefined) {
      conditions.push(`p.pay_year = $${idx++}`);
      values.push(filter.payYear);
    }
    if (filter.status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(filter.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filter.page - 1) * filter.pageSize;

    const countRes = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM payslips p ${where}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const rowsRes = await this.getPool().query<PayslipDbRow>(
      `${SELECT_PAYSLIP} ${where}
       ORDER BY p.pay_year DESC, p.pay_month DESC, e.employee_code ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, filter.pageSize, offset],
    );

    return { items: rowsRes.rows.map(toPayslipRecord), total };
  }

  async findById(id: string): Promise<PayslipRecord | null> {
    const res = await this.getPool().query<PayslipDbRow>(`${SELECT_PAYSLIP} WHERE p.id = $1`, [id]);
    return res.rows[0] ? toPayslipRecord(res.rows[0]) : null;
  }

  async findByIdForEmployee(id: string, employeeId: string): Promise<PayslipRecord | null> {
    const res = await this.getPool().query<PayslipDbRow>(
      `${SELECT_PAYSLIP} WHERE p.id = $1 AND p.employee_id = $2 AND p.status = 'published'`,
      [id, employeeId],
    );
    return res.rows[0] ? toPayslipRecord(res.rows[0]) : null;
  }

  async create(dto: UpsertPayslipDto, actorEmployeeId?: string): Promise<PayslipRecord> {
    const status = dto.status ?? 'draft';
    const empRes = await this.getPool().query<{
      employee_code: string;
      full_name: string;
      designation: string | null;
    }>(
      `SELECT e.employee_code,
              TRIM(e.first_name || ' ' || e.last_name) AS full_name,
              d.title AS designation
         FROM employees e
         LEFT JOIN designations d ON d.id = e.designation_id
        WHERE e.id = $1`,
      [dto.employeeId],
    );
    if (!empRes.rows[0]) {
      throw notFound('Employee not found');
    }
    const empMeta = empRes.rows[0];

    try {
      const insertRes = await this.getPool().query<{ id: string }>(
        `INSERT INTO payslips (
          employee_id, pay_month, pay_year, status,
          employee_display_name, emp_no, designation, uan, pan,
          bank_name, account_number, days_paid,
          leave_sl, leave_el, leave_cl, leave_fl, leave_lc,
          location, base_branch, work_location, beneficiary_id,
          basic_arrears_paise, basic_current_paise,
          hra_arrears_paise, hra_current_paise,
          performance_arrears_paise, performance_current_paise,
          variable_arrears_paise, variable_current_paise,
          pf_deduction_paise, income_tax_paise, professional_tax_paise,
          other_deduction_label, other_deduction_paise,
          retiral_pf_paise, retiral_gratuity_paise,
          annual_income_paise, annual_deductions_paise, net_taxable_income_paise,
          total_tax_payable_paise, tax_deducted_till_now_paise, balance_tax_paise,
          published_at, published_by_employee_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23,
          $24, $25,
          $26, $27,
          $28, $29,
          $30, $31, $32,
          $33, $34,
          $35, $36,
          $37, $38, $39,
          $40, $41, $42,
          CASE WHEN $4 = 'published' THEN NOW() ELSE NULL END,
          CASE WHEN $4 = 'published' THEN $43::uuid ELSE NULL END
        ) RETURNING id`,
        [
          dto.employeeId,
          dto.payMonth,
          dto.payYear,
          status,
          empMeta.full_name,
          empMeta.employee_code,
          dto.designation ?? empMeta.designation ?? '',
          dto.uan ?? '',
          dto.pan ?? '',
          dto.bankName ?? '',
          dto.accountNumber ?? '',
          dto.daysPaid ?? 30,
          dto.leaveBalances?.sl ?? 0,
          dto.leaveBalances?.el ?? 0,
          dto.leaveBalances?.cl ?? 0,
          dto.leaveBalances?.fl ?? 0,
          dto.leaveBalances?.lc ?? 0,
          dto.workLocation ?? '',
          dto.baseBranch ?? '',
          dto.subLocation ?? dto.workLocation ?? '',
          dto.beneficiaryId ?? '',
          inrToPaise(dto.basicArrears),
          inrToPaise(dto.basicSalary),
          inrToPaise(dto.hraArrears),
          inrToPaise(dto.hra),
          inrToPaise(dto.performanceArrears),
          inrToPaise(dto.performancePay),
          inrToPaise(dto.variableArrears),
          inrToPaise(dto.variableAllowance),
          inrToPaise(dto.providentFund),
          inrToPaise(dto.incomeTax),
          inrToPaise(dto.professionalTax),
          dto.otherDeductionDesc ?? 'Desc.',
          inrToPaise(dto.otherDeductionAmount),
          inrToPaise(dto.retiralPf),
          inrToPaise(dto.retiralGratuity),
          inrToPaise(dto.annualIncome),
          inrToPaise(dto.taxDeductions),
          inrToPaise(dto.netTaxIncome),
          inrToPaise(dto.totalTaxPayable),
          inrToPaise(dto.taxDeductedTillNow),
          inrToPaise(dto.balanceTax),
          actorEmployeeId ?? null,
        ],
      );
      const created = await this.findById(insertRes.rows[0]!.id);
      if (!created) throw notFound('Payslip not found after creation');
      return created;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        throw conflict('A payslip already exists for this employee and month/year');
      }
      if (pgErr.code === '23503') {
        throw notFound('Employee not found');
      }
      throw err;
    }
  }

  async update(id: string, dto: Partial<UpsertPayslipDto>): Promise<PayslipRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    await this.getPool().query(
      `UPDATE payslips SET
        designation = $2,
        uan = $3,
        pan = $4,
        bank_name = $5,
        account_number = $6,
        beneficiary_id = $7,
        location = $8,
        base_branch = $9,
        work_location = $10,
        days_paid = $11,
        leave_sl = $12,
        leave_el = $13,
        leave_cl = $14,
        leave_fl = $15,
        leave_lc = $16,
        basic_current_paise = $17,
        basic_arrears_paise = $18,
        hra_current_paise = $19,
        hra_arrears_paise = $20,
        performance_current_paise = $21,
        performance_arrears_paise = $22,
        variable_current_paise = $23,
        variable_arrears_paise = $24,
        pf_deduction_paise = $25,
        income_tax_paise = $26,
        professional_tax_paise = $27,
        other_deduction_label = $28,
        other_deduction_paise = $29,
        retiral_pf_paise = $30,
        retiral_gratuity_paise = $31,
        annual_income_paise = $32,
        annual_deductions_paise = $33,
        net_taxable_income_paise = $34,
        total_tax_payable_paise = $35,
        tax_deducted_till_now_paise = $36,
        balance_tax_paise = $37,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1`,
      [
        id,
        dto.designation ?? existing.designation,
        dto.uan ?? existing.uan,
        dto.pan ?? existing.pan,
        dto.bankName ?? existing.bankName,
        dto.accountNumber ?? existing.accountNumber,
        dto.beneficiaryId ?? existing.beneficiaryId,
        dto.workLocation ?? existing.workLocation,
        dto.baseBranch ?? existing.baseBranch,
        dto.subLocation ?? existing.subLocation,
        dto.daysPaid ?? existing.daysPaid,
        dto.leaveBalances?.sl ?? existing.leaveBalances.sl,
        dto.leaveBalances?.el ?? existing.leaveBalances.el,
        dto.leaveBalances?.cl ?? existing.leaveBalances.cl,
        dto.leaveBalances?.fl ?? existing.leaveBalances.fl,
        dto.leaveBalances?.lc ?? existing.leaveBalances.lc,
        inrToPaise(dto.basicSalary ?? existing.basicSalary),
        inrToPaise(dto.basicArrears ?? existing.basicArrears),
        inrToPaise(dto.hra ?? existing.hra),
        inrToPaise(dto.hraArrears ?? existing.hraArrears),
        inrToPaise(dto.performancePay ?? existing.performancePay),
        inrToPaise(dto.performanceArrears ?? existing.performanceArrears),
        inrToPaise(dto.variableAllowance ?? existing.variableAllowance),
        inrToPaise(dto.variableArrears ?? existing.variableArrears),
        inrToPaise(dto.providentFund ?? existing.providentFund),
        inrToPaise(dto.incomeTax ?? existing.incomeTax),
        inrToPaise(dto.professionalTax ?? existing.professionalTax),
        dto.otherDeductionDesc ?? existing.otherDeductionDesc,
        inrToPaise(dto.otherDeductionAmount ?? existing.otherDeductionAmount),
        inrToPaise(dto.retiralPf ?? existing.retiralPf),
        inrToPaise(dto.retiralGratuity ?? existing.retiralGratuity),
        inrToPaise(dto.annualIncome ?? existing.annualIncome),
        inrToPaise(dto.taxDeductions ?? existing.taxDeductions),
        inrToPaise(dto.netTaxIncome ?? existing.netTaxIncome),
        inrToPaise(dto.totalTaxPayable ?? existing.totalTaxPayable),
        inrToPaise(dto.taxDeductedTillNow ?? existing.taxDeductedTillNow),
        inrToPaise(dto.balanceTax ?? existing.balanceTax),
      ],
    );

    return this.findById(id);
  }

  async publish(id: string, actorEmployeeId?: string): Promise<PayslipRecord | null> {
    const res = await this.getPool().query<{ id: string }>(
      `UPDATE payslips
         SET status = 'published',
             published_at = COALESCE(published_at, NOW()),
             published_by_employee_id = COALESCE(published_by_employee_id, $2::uuid),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id, actorEmployeeId ?? null],
    );
    if (!res.rows[0]) return null;
    return this.findById(id);
  }
}
