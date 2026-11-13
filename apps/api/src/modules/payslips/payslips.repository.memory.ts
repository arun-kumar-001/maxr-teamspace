import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../http/errors';
import type { IPayslipsRepository } from './payslips.repository';
import {
  formatPayslipPeriod,
  type ListPayslipsFilter,
  type PayslipLeaveBalances,
  type PayslipRecord,
  type UpsertPayslipDto,
} from './payslips.types';

export interface SeedEmployeeMeta {
  employeeCode: string;
  employeeName: string;
  departmentName?: string | null;
}

export class InMemoryPayslipsRepository implements IPayslipsRepository {
  private readonly records = new Map<string, PayslipRecord>();

  constructor(private readonly employees: Record<string, SeedEmployeeMeta> = {}) {}

  private compute(record: PayslipRecord): PayslipRecord {
    const totalCurrentEarnings =
      record.basicSalary + record.hra + record.performancePay + record.variableAllowance;
    const totalArrearsEarnings =
      record.basicArrears + record.hraArrears + record.performanceArrears + record.variableArrears;
    const totalEarnings = totalCurrentEarnings + totalArrearsEarnings;
    const totalDeductions =
      record.providentFund +
      record.incomeTax +
      record.professionalTax +
      record.otherDeductionAmount;
    const netPay = Math.max(0, totalEarnings - totalDeductions);
    return {
      ...record,
      periodLabel: formatPayslipPeriod(record.payMonth, record.payYear),
      totalCurrentEarnings,
      totalArrearsEarnings,
      totalEarnings,
      totalDeductions,
      netPay,
    };
  }

  async listMine(
    employeeId: string,
    filter: ListPayslipsFilter,
  ): Promise<{ items: PayslipRecord[]; total: number }> {
    const matching = [...this.records.values()]
      .filter((r) => r.employeeId === employeeId && r.status === 'published')
      .filter((r) => (filter.payMonth !== undefined ? r.payMonth === filter.payMonth : true))
      .filter((r) => (filter.payYear !== undefined ? r.payYear === filter.payYear : true))
      .sort((a, b) => b.payYear - a.payYear || b.payMonth - a.payMonth);

    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: matching.slice(start, start + filter.pageSize),
      total: matching.length,
    };
  }

  async listAll(filter: ListPayslipsFilter): Promise<{ items: PayslipRecord[]; total: number }> {
    const matching = [...this.records.values()]
      .filter((r) => (filter.employeeId ? r.employeeId === filter.employeeId : true))
      .filter((r) => (filter.payMonth !== undefined ? r.payMonth === filter.payMonth : true))
      .filter((r) => (filter.payYear !== undefined ? r.payYear === filter.payYear : true))
      .filter((r) => (filter.status ? r.status === filter.status : true))
      .sort((a, b) => b.payYear - a.payYear || b.payMonth - a.payMonth);

    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: matching.slice(start, start + filter.pageSize),
      total: matching.length,
    };
  }

  async findById(id: string): Promise<PayslipRecord | null> {
    return this.records.get(id) ?? null;
  }

  async findByIdForEmployee(id: string, employeeId: string): Promise<PayslipRecord | null> {
    const found = this.records.get(id);
    if (!found || found.employeeId !== employeeId || found.status !== 'published') {
      return null;
    }
    return found;
  }

  async create(dto: UpsertPayslipDto, actorId: string): Promise<PayslipRecord> {
    const duplicate = [...this.records.values()].some(
      (r) =>
        r.employeeId === dto.employeeId && r.payMonth === dto.payMonth && r.payYear === dto.payYear,
    );
    if (duplicate) {
      throw conflict('A payslip already exists for this employee and month/year');
    }

    const meta = this.employees[dto.employeeId];
    if (!meta) {
      throw notFound('Employee not found');
    }

    const now = new Date().toISOString();
    const status = dto.status ?? 'draft';
    const leaveBalances: PayslipLeaveBalances = {
      sl: dto.leaveBalances?.sl ?? 0,
      el: dto.leaveBalances?.el ?? 0,
      cl: dto.leaveBalances?.cl ?? 0,
      fl: dto.leaveBalances?.fl ?? 0,
      lc: dto.leaveBalances?.lc ?? 0,
    };

    const record = this.compute({
      id: randomUUID(),
      employeeId: dto.employeeId,
      employeeCode: meta.employeeCode,
      employeeName: meta.employeeName,
      departmentName: meta.departmentName ?? null,
      payMonth: dto.payMonth,
      payYear: dto.payYear,
      periodLabel: formatPayslipPeriod(dto.payMonth, dto.payYear),
      status,
      designation: dto.designation ?? '',
      uan: dto.uan ?? '',
      pan: dto.pan ?? '',
      bankName: dto.bankName ?? '',
      accountNumber: dto.accountNumber ?? '',
      beneficiaryId: dto.beneficiaryId ?? '',
      workLocation: dto.workLocation ?? '',
      baseBranch: dto.baseBranch ?? '',
      subLocation: dto.subLocation ?? dto.workLocation ?? '',
      daysPaid: dto.daysPaid ?? 30,
      leaveBalances,
      basicSalary: dto.basicSalary,
      basicArrears: dto.basicArrears ?? 0,
      hra: dto.hra ?? 0,
      hraArrears: dto.hraArrears ?? 0,
      performancePay: dto.performancePay ?? 0,
      performanceArrears: dto.performanceArrears ?? 0,
      variableAllowance: dto.variableAllowance ?? 0,
      variableArrears: dto.variableArrears ?? 0,
      totalCurrentEarnings: 0,
      totalArrearsEarnings: 0,
      totalEarnings: 0,
      providentFund: dto.providentFund ?? 0,
      incomeTax: dto.incomeTax ?? 0,
      professionalTax: dto.professionalTax ?? 0,
      otherDeductionDesc: dto.otherDeductionDesc ?? '',
      otherDeductionAmount: dto.otherDeductionAmount ?? 0,
      totalDeductions: 0,
      netPay: 0,
      retiralPf: dto.retiralPf ?? 0,
      retiralGratuity: dto.retiralGratuity ?? 0,
      annualIncome: dto.annualIncome ?? 0,
      taxDeductions: dto.taxDeductions ?? 0,
      netTaxIncome: dto.netTaxIncome ?? 0,
      totalTaxPayable: dto.totalTaxPayable ?? 0,
      taxDeductedTillNow: dto.taxDeductedTillNow ?? 0,
      balanceTax: dto.balanceTax ?? 0,
      publishedAt: status === 'published' ? now : null,
      publishedBy: status === 'published' ? actorId : null,
      createdAt: now,
      updatedAt: now,
    });

    this.records.set(record.id, record);
    return record;
  }

  async update(id: string, dto: Partial<UpsertPayslipDto>): Promise<PayslipRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;

    const updated = this.compute({
      ...existing,
      ...dto,
      leaveBalances: {
        ...existing.leaveBalances,
        ...dto.leaveBalances,
      },
      updatedAt: new Date().toISOString(),
    });
    this.records.set(id, updated);
    return updated;
  }

  async publish(id: string, actorId: string): Promise<PayslipRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const published: PayslipRecord = {
      ...existing,
      status: 'published',
      publishedAt: existing.publishedAt ?? now,
      publishedBy: existing.publishedBy ?? actorId,
      updatedAt: now,
    };
    this.records.set(id, published);
    return published;
  }
}
