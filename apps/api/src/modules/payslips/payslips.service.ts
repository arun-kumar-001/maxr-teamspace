import { PaginatedResponse, ROLES } from '@maxr/shared';
import { forbidden, notFound } from '../../http/errors';
import { buildPage } from '../../http/pagination';
import type { AuditLogger } from '../../platform/audit/types';
import { renderPayslipPdf } from './payslips.pdf';
import type { IPayslipsRepository } from './payslips.repository';
import type { CreatePayslipInput, ListPayslipsQuery, UpdatePayslipInput } from './payslips.schemas';
import { buildPayslipFilename, type PayslipCaller, type PayslipRecord } from './payslips.types';

export class PayslipsService {
  constructor(
    private readonly repo: IPayslipsRepository,
    private readonly audit?: AuditLogger,
  ) {}

  private isPayrollAdmin(role: string): boolean {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  async listMine(
    query: ListPayslipsQuery,
    caller: PayslipCaller,
  ): Promise<PaginatedResponse<PayslipRecord>> {
    if (!caller.employeeId) {
      throw forbidden('No linked employee profile found for current user');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { items, total } = await this.repo.listMine(caller.employeeId, {
      page,
      pageSize,
      payMonth: query.payMonth,
      payYear: query.payYear,
    });

    return buildPage(items, total, { page, pageSize });
  }

  async listAll(query: ListPayslipsQuery): Promise<PaginatedResponse<PayslipRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { items, total } = await this.repo.listAll({
      page,
      pageSize,
      employeeId: query.employeeId,
      payMonth: query.payMonth,
      payYear: query.payYear,
      status: query.status,
    });

    return buildPage(items, total, { page, pageSize });
  }

  async getById(id: string, caller: PayslipCaller): Promise<PayslipRecord> {
    if (this.isPayrollAdmin(caller.actorRole)) {
      const record = await this.repo.findById(id);
      if (!record) throw notFound('Payslip not found');
      return record;
    }

    if (!caller.employeeId) {
      throw notFound('Payslip not found');
    }

    // Deny by default for non-HR/Admin: only own published payslips, return 404 otherwise.
    const record = await this.repo.findByIdForEmployee(id, caller.employeeId);
    if (!record) {
      throw notFound('Payslip not found');
    }
    return record;
  }

  async create(input: CreatePayslipInput, caller: PayslipCaller): Promise<PayslipRecord> {
    const created = await this.repo.create(input, caller.employeeId ?? caller.actorId);

    await this.audit?.tryRecord({
      action: 'payslips.create',
      outcome: 'success',
      actorId: caller.actorId,
      actorRole: caller.actorRole,
      entityType: 'payslip',
      entityId: created.id,
      metadata: {
        employeeId: created.employeeId,
        payMonth: created.payMonth,
        payYear: created.payYear,
        status: created.status,
      },
      requestId: caller.requestId,
    });

    return created;
  }

  async update(
    id: string,
    input: UpdatePayslipInput,
    caller: PayslipCaller,
  ): Promise<PayslipRecord> {
    const updated = await this.repo.update(id, input);
    if (!updated) {
      throw notFound('Payslip not found');
    }

    await this.audit?.tryRecord({
      action: 'payslips.update',
      outcome: 'success',
      actorId: caller.actorId,
      actorRole: caller.actorRole,
      entityType: 'payslip',
      entityId: updated.id,
      metadata: { payMonth: updated.payMonth, payYear: updated.payYear },
      requestId: caller.requestId,
    });

    return updated;
  }

  async publish(id: string, caller: PayslipCaller): Promise<PayslipRecord> {
    const published = await this.repo.publish(id, caller.employeeId ?? caller.actorId);
    if (!published) {
      throw notFound('Payslip not found');
    }

    await this.audit?.tryRecord({
      action: 'payslips.publish',
      outcome: 'success',
      actorId: caller.actorId,
      actorRole: caller.actorRole,
      entityType: 'payslip',
      entityId: published.id,
      metadata: {
        employeeId: published.employeeId,
        payMonth: published.payMonth,
        payYear: published.payYear,
      },
      requestId: caller.requestId,
    });

    return published;
  }

  async downloadPdf(
    id: string,
    caller: PayslipCaller,
  ): Promise<{ buffer: Buffer; filename: string; payslip: PayslipRecord }> {
    const payslip = await this.getById(id, caller);
    const buffer = await renderPayslipPdf(payslip);
    const filename = buildPayslipFilename(payslip);

    await this.audit?.tryRecord({
      action: 'payslips.download_pdf',
      outcome: 'success',
      actorId: caller.actorId,
      actorRole: caller.actorRole,
      entityType: 'payslip',
      entityId: payslip.id,
      metadata: {
        employeeId: payslip.employeeId,
        payMonth: payslip.payMonth,
        payYear: payslip.payYear,
      },
      requestId: caller.requestId,
    });

    return { buffer, filename, payslip };
  }
}
