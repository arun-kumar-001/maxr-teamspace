import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { RawUpload } from '../../http/raw-upload';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import type {
  Approval,
  ApprovalHandler,
  ApprovalOutcome,
  ApprovalsService,
  ApprovalTx,
} from '../approvals';
import { ScopeFilter } from '../rbac';
import type { CompanySettingsReader } from '../settings';
import { assertClaimDate, assertReceiptRule, assertTransition } from './expenses.rules';
import { IExpensesRepository } from './expenses.repository';
import {
  EXPENSE_SUBJECT,
  ExpenseCategory,
  ExpenseClaim,
  ExpenseClaimRecord,
  ExpenseStatus,
} from './expenses.types';
import type {
  CreateClaimInput,
  CreateCategoryInput,
  ListClaimsQuery,
  ListMyClaimsQuery,
} from './expenses.schemas';

type Deps = Pick<PlatformServices, 'audit' | 'events' | 'storage'>;

/** Who is calling, taken from the session by the route, never from the request body. */
export interface ExpenseCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const visible = ({ receiptKey: _key, ...claim }: ExpenseClaimRecord): ExpenseClaim => claim;

/**
 * Expense claims (#29, D-17). A claim is a draft until the claimant submits it; submitting opens a
 * two-step approval (manager, then HR). The approvals engine calls `apply` with the final decision.
 */
export class ExpensesService implements ApprovalHandler {
  readonly subjectType = EXPENSE_SUBJECT;

  constructor(
    private readonly repository: IExpensesRepository,
    private readonly approvals: Pick<ApprovalsService, 'route' | 'submit' | 'cancel'>,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  listCategories(): Promise<ExpenseCategory[]> {
    return this.repository.listActiveCategories();
  }

  async createCategory(
    input: CreateCategoryInput,
    caller: ExpenseCaller,
  ): Promise<ExpenseCategory> {
    const category = await this.repository.insertCategory(input);
    await this.audit(caller).record({
      action: 'expense.category_create',
      outcome: 'success',
      entityType: 'expense_category',
      entityId: category.id,
      metadata: { code: category.code },
    });
    return category;
  }

  async deactivateCategory(id: string, caller: ExpenseCaller): Promise<ExpenseCategory> {
    const category = await this.repository.setCategoryActive(id, false);
    if (!category) throw notFound('Expense category not found');
    await this.audit(caller).record({
      action: 'expense.category_deactivate',
      outcome: 'success',
      entityType: 'expense_category',
      entityId: id,
      metadata: { code: category.code },
    });
    return category;
  }

  /** Creates a draft claim. Nothing is routed for approval until `submit`. */
  async create(input: CreateClaimInput, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const category = await this.repository.findCategory(input.categoryId);
    if (!category?.isActive) throw unprocessable('Choose an active expense category');
    assertClaimDate(input.expenseDate, await this.companyToday());

    const claim = await this.repository.transaction(async (tx) => {
      const created = await this.repository.insertClaim(tx, {
        employeeId: caller.employeeId,
        categoryId: category.id,
        expenseDate: input.expenseDate,
        amountMinor: input.amountMinor,
        description: input.description ?? null,
      });
      // The description can name a client or a person, so the trail holds the facts only.
      await this.audit(caller).record(
        {
          action: 'expense.create',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: created.id,
          metadata: { categoryCode: category.code, amountMinor: input.amountMinor },
        },
        { transaction: tx },
      );
      return created;
    });
    return visible(claim);
  }

  /**
   * Stores the receipt for a draft claim of the caller. The file is checked and stored before the
   * database write; if the write fails the stored file is removed again.
   */
  async attachReceipt(id: string, file: RawUpload, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const own = await this.repository.find(id, { kind: 'own', employeeId: caller.employeeId });
    if (!own) throw notFound('Expense claim not found');
    if (own.status !== 'draft') {
      throw conflict('A receipt can only be attached to a draft claim');
    }
    const stored = await this.platform.storage.upload({
      category: 'receipts',
      filename: file.filename,
      declaredType: file.declaredType,
      body: file.body,
      uploadedBy: caller.actorId,
    });
    try {
      return await this.repository.transaction(async (tx) => {
        const locked = await this.repository.findForUpdate(tx, id);
        if (!locked || locked.employeeId !== caller.employeeId) {
          throw notFound('Expense claim not found');
        }
        const attached = await this.repository.attachReceipt(tx, id, {
          key: stored.key,
          name: stored.originalName,
          contentType: stored.contentType,
          size: stored.size,
          sha256: stored.sha256,
        });
        if (!attached) throw conflict('A receipt can only be attached to a draft claim');
        await this.audit(caller).record(
          {
            action: 'expense.receipt_attach',
            outcome: 'success',
            entityType: 'expense_claim',
            entityId: id,
            metadata: { contentType: stored.contentType, size: stored.size },
          },
          { transaction: tx },
        );
        const updated = await this.repository.findForUpdate(tx, id);
        return visible(updated ?? locked);
      });
    } catch (err) {
      await this.platform.storage.delete(stored.key).catch(() => false);
      throw err;
    }
  }

  /**
   * A short-lived link to the receipt. Only the claimant and someone who reviews the claim (the
   * `review` scope) may ask for it; anyone else gets a 404.
   */
  async receiptLink(
    id: string,
    caller: ExpenseCaller,
    reviewScope: ScopeFilter,
  ): Promise<{ url: string; expiresAt: string }> {
    const claim = await this.load(id, caller, reviewScope);
    if (!claim.receiptKey) throw notFound('This claim has no receipt');
    const link = await this.platform.storage.createDownloadLink(claim.receiptKey, {
      subject: caller.actorId,
    });
    return { url: link.url, expiresAt: link.expiresAt };
  }

  /**
   * Submits a draft: checks the claim window and the receipt rule, then opens the approval in the
   * same transaction. The claim is `submitted` from here until a decision.
   */
  async submit(id: string, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const events = new EventCollector();
    const submitted = await this.repository.transaction(async (tx) => {
      const claim = await this.repository.findForUpdate(tx, id);
      if (!claim || claim.employeeId !== caller.employeeId) {
        throw notFound('Expense claim not found');
      }
      assertTransition(claim.status, 'submitted');
      assertClaimDate(claim.expenseDate, await this.companyToday());
      assertReceiptRule(claim.amountMinor, claim.receiptKey !== null);

      const stages = await this.approvals.route(tx, caller.employeeId, { twoStep: true });
      const approval = await this.approvals.submit(
        tx,
        {
          subjectType: EXPENSE_SUBJECT,
          subjectId: id,
          requesterEmployeeId: caller.employeeId,
          stages,
        },
        events,
      );
      await this.repository.setStatus(tx, id, 'submitted');
      await this.audit(caller).record(
        {
          action: 'expense.submit',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: id,
          metadata: { amountMinor: claim.amountMinor, stages: approval.stages.length },
        },
        { transaction: tx },
      );
      return { ...claim, status: 'submitted' as const, approvalId: approval.id };
    });
    await events.flush(this.platform.events);
    return visible(submitted);
  }

  /**
   * Withdraws a draft or submitted claim. The approval is withdrawn first, the same lock order as
   * a decision, so a cancel and an approver's decision cannot deadlock.
   */
  async cancel(id: string, caller: ExpenseCaller): Promise<ExpenseClaim> {
    const preview = await this.repository.find(id, { kind: 'own', employeeId: caller.employeeId });
    if (!preview) throw notFound('Expense claim not found');
    const cancelled = await this.repository.transaction(async (tx) => {
      if (preview.status === 'submitted') {
        await this.approvals.cancel(tx, EXPENSE_SUBJECT, id);
      }
      const claim = await this.repository.findForUpdate(tx, id);
      if (!claim || claim.employeeId !== caller.employeeId) {
        throw notFound('Expense claim not found');
      }
      assertTransition(claim.status, 'cancelled');
      await this.repository.setStatus(tx, id, 'cancelled');
      await this.audit(caller).record(
        {
          action: 'expense.cancel',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: id,
          changes: { status: { from: claim.status, to: 'cancelled' } },
        },
        { transaction: tx },
      );
      return { ...claim, status: 'cancelled' as const };
    });
    return visible(cancelled);
  }

  /** HR marks an approved claim as paid out. Nobody reimburses their own claim. */
  async reimburse(
    id: string,
    caller: ExpenseCaller,
    reimburseScope: ScopeFilter,
  ): Promise<ExpenseClaim> {
    const inScope = await this.repository.find(id, reimburseScope);
    if (!inScope) throw notFound('Expense claim not found');
    if (inScope.employeeId === caller.employeeId) {
      throw forbidden('You cannot reimburse your own claim');
    }
    const reimbursed = await this.repository.transaction(async (tx) => {
      const claim = await this.repository.findForUpdate(tx, id);
      if (!claim) throw notFound('Expense claim not found');
      assertTransition(claim.status, 'reimbursed');
      await this.repository.setStatus(tx, id, 'reimbursed');
      await this.audit(caller).record(
        {
          action: 'expense.reimburse',
          outcome: 'success',
          entityType: 'expense_claim',
          entityId: id,
          changes: { status: { from: claim.status, to: 'reimbursed' } },
          metadata: { amountMinor: claim.amountMinor },
        },
        { transaction: tx },
      );
      return { ...claim, status: 'reimbursed' as const };
    });
    return visible(reimbursed);
  }

  /**
   * Called by the approvals engine inside the decision transaction, at the final decision only.
   * The claim must still be submitted; otherwise the approval and the claim disagree and the
   * whole decision is undone.
   */
  async apply(
    tx: ApprovalTx,
    approval: Approval,
    outcome: ApprovalOutcome,
    decider: { employeeId: string; actorId: string; requestId?: string },
  ): Promise<void> {
    const claim = await this.repository.findForUpdate(tx, approval.subjectId);
    if (!claim || claim.status !== 'submitted') {
      throw new Error(`Expense claim ${approval.subjectId} is not submitted but its approval is`);
    }
    const status: ExpenseStatus = outcome === 'approved' ? 'approved' : 'rejected';
    await this.repository.setStatus(tx, claim.id, status);
    await this.audit({ actorId: decider.actorId, requestId: decider.requestId }).record(
      {
        action: outcome === 'approved' ? 'expense.approve' : 'expense.reject',
        outcome: 'success',
        entityType: 'expense_claim',
        entityId: claim.id,
        changes: { status: { from: claim.status, to: status } },
        metadata: { amountMinor: claim.amountMinor },
      },
      { transaction: tx },
    );
  }

  /** The claimant's own claim, or one inside the reviewer's scope. Anything else is a 404. */
  async get(id: string, caller: ExpenseCaller, reviewScope: ScopeFilter): Promise<ExpenseClaim> {
    return visible(await this.load(id, caller, reviewScope));
  }

  async listMine(
    query: ListMyClaimsQuery,
    caller: ExpenseCaller,
  ): Promise<PaginatedResponse<ExpenseClaim>> {
    return this.page(query, { kind: 'own', employeeId: caller.employeeId });
  }

  async list(
    query: ListClaimsQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<ExpenseClaim>> {
    return this.page(query, filter);
  }

  private async load(
    id: string,
    caller: ExpenseCaller,
    reviewScope: ScopeFilter,
  ): Promise<ExpenseClaimRecord> {
    const own = await this.repository.find(id, { kind: 'own', employeeId: caller.employeeId });
    const found = own ?? (await this.repository.find(id, reviewScope));
    if (!found) throw notFound('Expense claim not found');
    return found;
  }

  private async page(
    query: ListClaimsQuery | ListMyClaimsQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<ExpenseClaim>> {
    const { items, total } = await this.repository.findMany({
      filter,
      employeeId: 'employeeId' in query ? query.employeeId : undefined,
      status: query.status,
      ...toOffsetLimit(query),
    });
    return buildPage(items.map(visible), total, query);
  }

  private audit(caller: { actorId: string; requestId?: string }) {
    return this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
  }

  private async companyToday(): Promise<string> {
    const { timezone } = await this.settings.getBasic();
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(this.clock());
  }
}
