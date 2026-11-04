import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../http/errors';
import { buildPage } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import {
  Approval,
  ApprovalHandler,
  ApprovalOutcome,
  ApprovalTx,
  ApprovalsService,
} from '../approvals';
import { ScopeFilter } from '../rbac';
import type {
  CreateExpenseClaimInput,
  DownloadLinkResult,
  ExpenseCaller,
  ExpenseCategory,
  ExpenseClaim,
  IExpensesRepository,
  ListExpenseClaimsQuery,
} from './expenses.types';

type Deps = Pick<PlatformServices, 'audit' | 'events' | 'storage'>;

export interface CompanySettingsReader {
  getBasic(): Promise<{ timezone: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB per D-17
const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);

const localDate = (instant: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
};

const minusDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

export class ExpensesService implements ApprovalHandler {
  readonly subjectType = 'expense_claim';

  constructor(
    private readonly repository: IExpensesRepository,
    private readonly approvals: Pick<ApprovalsService, 'route' | 'submit' | 'cancel'>,
    private readonly platform: Deps,
    private readonly settings?: CompanySettingsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Called by the Approvals engine within a transaction when a decision is recorded (approved or rejected).
   */
  async apply(
    tx: ApprovalTx,
    approval: Approval,
    outcome: ApprovalOutcome,
    decider: { employeeId: string; actorId: string; requestId?: string },
  ): Promise<void> {
    const audit = this.platform.audit.withContext({
      actorId: decider.actorId,
      requestId: decider.requestId,
    });

    if (outcome === 'approved') {
      await this.repository.updateClaimStatus(tx, approval.subjectId, 'approved');
      await audit.record(
        {
          action: 'expenses.approve',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: approval.subjectId,
          metadata: { deciderEmployeeId: decider.employeeId },
        },
        { transaction: tx },
      );
    } else {
      const lastDecision = approval.decisions[approval.decisions.length - 1];
      const rejectionReason = lastDecision?.comment ?? null;
      await this.repository.updateClaimStatus(tx, approval.subjectId, 'rejected', {
        rejectionReason,
      });
      await audit.record(
        {
          action: 'expenses.reject',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: approval.subjectId,
          metadata: {
            deciderEmployeeId: decider.employeeId,
            reason: rejectionReason,
          },
        },
        { transaction: tx },
      );
    }
  }

  /**
   * Submit an expense claim (D-17):
   * - 60 day historical limit, no future dates
   * - Receipt required if amount > 20,000 paise (₹200.00)
   * - Max 10,000,000 paise (₹100,000.00)
   * - Validates category is active
   * - Routes 2-step (manager -> HR) or HR only via approvals engine
   */
  async submitClaim(caller: ExpenseCaller, input: CreateExpenseClaimInput): Promise<ExpenseClaim> {
    // 1. Amount validation
    if (input.amountPaise <= 0) {
      throw unprocessable('Amount must be greater than zero');
    }
    if (input.amountPaise > 10_000_000) {
      throw unprocessable('Amount cannot exceed ₹100,000.00 (10,000,000 paise)');
    }

    // 2. Receipt requirement check: required above ₹200.00 (20,000 paise)
    if (input.amountPaise > 20_000 && !input.receipt) {
      throw unprocessable('Receipt is required for expense claims over ₹200.00');
    }

    // 3. Date validation in company timezone
    const timezone = (await this.settings?.getBasic())?.timezone ?? 'UTC';
    const today = localDate(this.clock(), timezone);
    if (input.expenseDate > today) {
      throw unprocessable('Expense date cannot be in the future');
    }
    const sixtyDaysAgo = minusDays(today, 60);
    if (input.expenseDate < sixtyDaysAgo) {
      throw unprocessable('Expense claim cannot be older than 60 days');
    }

    // 4. Receipt validation and upload if provided
    let receiptStorageKey: string | null = null;
    let receiptFilename: string | null = null;
    let receiptMimeType: string | null = null;
    let receiptFileSize: number | null = null;

    if (input.receipt) {
      if (input.receipt.body.length > MAX_RECEIPT_BYTES) {
        throw unprocessable('Receipt file size cannot exceed 5 MB');
      }
      if (!ALLOWED_RECEIPT_MIME_TYPES.has(input.receipt.declaredType.toLowerCase())) {
        throw unprocessable('Receipt must be a PDF, JPEG, or PNG document');
      }

      const stored = await this.platform.storage.upload({
        category: 'receipts',
        filename: input.receipt.filename,
        declaredType: input.receipt.declaredType,
        body: input.receipt.body,
        uploadedBy: caller.actorId,
      });

      receiptStorageKey = stored.key;
      receiptFilename = input.receipt.filename;
      receiptMimeType = stored.contentType;
      receiptFileSize = stored.size;
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();

    const created = await this.repository.transaction(async (tx) => {
      // 5. Category validation
      const category = await this.repository.findCategoryById(tx, input.categoryId);
      if (!category || !category.isActive) {
        throw unprocessable('Please choose an active expense category');
      }

      // 6. Approvals routing (twoStep per D-17)
      const stages = await this.approvals.route(tx, caller.employeeId, { twoStep: true });

      // 7. Store claim
      const claim = await this.repository.createClaim(tx, {
        employeeId: caller.employeeId,
        categoryId: input.categoryId,
        amountPaise: input.amountPaise,
        currency: 'INR',
        expenseDate: input.expenseDate,
        description: input.description,
        receiptStorageKey,
        receiptFilename,
        receiptMimeType,
        receiptFileSize,
        status: 'submitted',
      });

      // 8. Submit to approvals engine in the same transaction
      await this.approvals.submit(
        tx,
        {
          subjectType: this.subjectType,
          subjectId: claim.id,
          requesterEmployeeId: caller.employeeId,
          stages,
        },
        events,
      );

      await audit.record(
        {
          action: 'expenses.submit',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: claim.id,
          metadata: {
            amountPaise: claim.amountPaise,
            categoryId: claim.categoryId,
            hasReceipt: !!receiptStorageKey,
          },
        },
        { transaction: tx },
      );

      events.add({
        type: 'expenses.submitted',
        payload: {
          claimId: claim.id,
          employeeId: caller.employeeId,
          amountPaise: claim.amountPaise,
        },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });

      return claim;
    });

    await events.flush(this.platform.events);
    return created;
  }

  /**
   * Cancel an expense claim (D-17):
   * - Claimant can cancel while in 'submitted' status
   * - Cancels the pending approval in the engine
   */
  async cancelClaim(id: string, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();

    const cancelled = await this.repository.transaction(async (tx) => {
      const claim = await this.repository.findClaimById(tx, id);
      if (!claim || claim.employeeId !== caller.employeeId) {
        throw notFound('Expense claim not found');
      }

      if (claim.status !== 'submitted') {
        throw conflict(`Cannot cancel an expense claim with status '${claim.status}'`);
      }

      await this.approvals.cancel(tx, this.subjectType, id);
      const updated = await this.repository.updateClaimStatus(tx, id, 'cancelled');
      if (!updated) throw notFound('Expense claim not found');

      await audit.record(
        {
          action: 'expenses.cancel',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: id,
        },
        { transaction: tx },
      );

      events.add({
        type: 'expenses.cancelled',
        payload: { claimId: id, employeeId: caller.employeeId },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });

      return updated;
    });

    await events.flush(this.platform.events);
    return cancelled;
  }

  /**
   * Mark an approved expense claim as reimbursed (HR Manager / Admin).
   */
  async reimburseClaim(id: string, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();

    const reimbursed = await this.repository.transaction(async (tx) => {
      const claim = await this.repository.findClaimById(tx, id);
      if (!claim) {
        throw notFound('Expense claim not found');
      }

      if (claim.status !== 'approved') {
        throw conflict(
          `Only approved expense claims can be marked as reimbursed (current: '${claim.status}')`,
        );
      }

      const updated = await this.repository.updateClaimStatus(tx, id, 'reimbursed', {
        reimbursedAt: this.clock().toISOString(),
        reimbursedByEmployeeId: caller.employeeId,
      });
      if (!updated) throw notFound('Expense claim not found');

      await audit.record(
        {
          action: 'expenses.reimburse',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: id,
          metadata: { reimbursedByEmployeeId: caller.employeeId },
        },
        { transaction: tx },
      );

      events.add({
        type: 'expenses.reimbursed',
        payload: { claimId: id, employeeId: claim.employeeId, amountPaise: claim.amountPaise },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });

      return updated;
    });

    await events.flush(this.platform.events);
    return reimbursed;
  }

  /**
   * Retrieve a single claim if caller has scope.
   */
  async getClaim(id: string, caller: ExpenseCaller, filter: ScopeFilter): Promise<ExpenseClaim> {
    return this.repository.transaction(async (tx) => {
      const own = await this.repository.findClaimById(tx, id, {
        kind: 'own',
        employeeId: caller.employeeId,
      });
      const found = own ?? (await this.repository.findClaimById(tx, id, filter));
      if (!found) {
        throw notFound('Expense claim not found');
      }
      return found;
    });
  }

  /**
   * List claims with scope enforcement and pagination.
   */
  async listClaims(
    query: ListExpenseClaimsQuery,
    _caller: ExpenseCaller,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<ExpenseClaim>> {
    return this.repository.transaction(async (tx) => {
      const { items, total } = await this.repository.findManyClaims(tx, query, filter);
      return buildPage(items, total, { page: query.page, pageSize: query.pageSize });
    });
  }

  /**
   * List claims belonging to the caller.
   */
  async listMyClaims(
    query: ListExpenseClaimsQuery,
    caller: ExpenseCaller,
  ): Promise<PaginatedResponse<ExpenseClaim>> {
    return this.repository.transaction(async (tx) => {
      const { items, total } = await this.repository.findManyClaims(tx, query, {
        kind: 'own',
        employeeId: caller.employeeId,
      });
      return buildPage(items, total, { page: query.page, pageSize: query.pageSize });
    });
  }

  /**
   * Create a signed download link for receipt.
   * Access limited to claimant or in-scope approver (D-17).
   */
  async createReceiptDownloadLink(
    id: string,
    caller: ExpenseCaller,
    filter: ScopeFilter,
  ): Promise<DownloadLinkResult> {
    const claim = await this.getClaim(id, caller, filter);
    if (!claim.receiptStorageKey) {
      throw notFound('No receipt attached to this expense claim');
    }

    const link = await this.platform.storage.createDownloadLink(claim.receiptStorageKey, {
      subject: caller.actorId,
      ttlSeconds: 900,
    });

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    await audit.record({
      action: 'expenses.download_receipt',
      outcome: 'success',
      entityType: 'expense_claim',
      entityId: id,
    });

    return {
      url: link.url,
      expiresAt: link.expiresAt,
    };
  }

  /**
   * Category helpers.
   */
  async listCategories(activeOnly = true): Promise<ExpenseCategory[]> {
    return this.repository.transaction(async (tx) => {
      return this.repository.listCategories(tx, activeOnly);
    });
  }

  async createCategory(
    input: { name: string; description?: string | null },
    caller: ExpenseCaller,
  ): Promise<ExpenseCategory> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    return this.repository.transaction(async (tx) => {
      const cat = await this.repository.createCategory(tx, input);
      await audit.record(
        {
          action: 'expenses.create_category',
          outcome: 'success',
          entityType: 'expense_category',
          entityId: cat.id,
          metadata: { name: cat.name },
        },
        { transaction: tx },
      );
      return cat;
    });
  }

  async updateCategory(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
    caller: ExpenseCaller,
  ): Promise<ExpenseCategory> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    return this.repository.transaction(async (tx) => {
      const cat = await this.repository.updateCategory(tx, id, input);
      if (!cat) throw notFound('Expense category not found');

      await audit.record(
        {
          action: 'expenses.update_category',
          outcome: 'success',
          entityType: 'expense_category',
          entityId: id,
          metadata: input,
        },
        { transaction: tx },
      );
      return cat;
    });
  }
}
