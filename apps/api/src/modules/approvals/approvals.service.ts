import { PaginatedResponse, ROLES, type Role } from '@maxr/shared';
import { AppError } from '../../http/app-error';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { ScopeFilter, scopeAllows } from '../rbac';
import { currentStageOf, defaultRoute, denialReason } from './approval-rules';
import { IApprovalsRepository } from './approvals.repository';
import {
  APPROVAL_TRANSITIONS,
  Approval,
  ApprovalFilters,
  ApprovalHandler,
  ApprovalOutcome,
  ApprovalStage,
  ApprovalStatus,
  ApprovalTx,
  SubmitApprovalInput,
} from './approvals.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** Who is calling, taken from the session by the route, never from the request body. */
export interface ApprovalCaller {
  actorId: string;
  employeeId: string;
  roles: readonly Role[];
  requestId?: string;
}

export interface ApprovalListQuery extends ApprovalFilters {
  page: number;
  pageSize: number;
}

const DENIAL_MESSAGES = {
  own_request: 'You cannot decide your own request',
  already_decided: 'You already decided an earlier step of this request',
  not_your_stage: 'This request is not waiting for your decision',
  not_pending: 'This request is no longer pending',
} as const;

function assertTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  if (!APPROVAL_TRANSITIONS[from].includes(to)) {
    throw conflict(`An approval that is ${from} cannot become ${to}`);
  }
}

export class ApprovalsService {
  private readonly handlers = new Map<string, ApprovalHandler>();

  constructor(
    private readonly repository: IApprovalsRepository,
    private readonly platform: Deps,
  ) {}

  /** A module registers how its subject type reacts to a final decision (leave, correction, expense). */
  registerHandler(handler: ApprovalHandler): void {
    if (this.handlers.has(handler.subjectType)) {
      throw new Error(`An approval handler for '${handler.subjectType}' is already registered`);
    }
    this.handlers.set(handler.subjectType, handler);
  }

  /**
   * The route for a new request (D-12, D-17). Call it with the same transaction that stores the
   * subject, then pass the result to `submit`.
   */
  async route(
    tx: ApprovalTx,
    requesterEmployeeId: string,
    options: { twoStep?: boolean } = {},
  ): Promise<ApprovalStage[]> {
    const context = await this.repository.getRequesterContext(tx, requesterEmployeeId);
    if (!context) throw unprocessable('The requester does not exist');
    return defaultRoute(context, options.twoStep ?? false);
  }

  /**
   * Opens the approval for a subject, inside the transaction that stores the subject, so either
   * both exist or neither does. Not an HTTP route: only a module that owns a subject can submit.
   */
  async submit(
    tx: ApprovalTx,
    input: SubmitApprovalInput,
    events?: EventCollector,
  ): Promise<Approval> {
    if (!this.handlers.has(input.subjectType)) {
      throw new Error(`No approval handler is registered for '${input.subjectType}'`);
    }
    if (input.stages.length === 0) throw new Error('An approval needs at least one stage');
    const approval = await this.repository.insert(tx, input);
    events?.add({
      type: 'approvals.requested',
      payload: {
        approvalId: approval.id,
        subjectType: approval.subjectType,
        subjectId: approval.subjectId,
        stage: currentStageOf(approval),
      },
      actorId: input.requesterEmployeeId,
    });
    return approval;
  }

  /**
   * Withdraws a pending approval when the requester cancels the subject. Returns null when the
   * subject has no approval; a decided approval cannot be withdrawn (409).
   */
  async cancel(tx: ApprovalTx, subjectType: string, subjectId: string): Promise<Approval | null> {
    const approval = await this.repository.lockBySubject(tx, subjectType, subjectId);
    if (!approval) return null;
    assertTransition(approval.status, 'cancelled');
    return this.repository.markCancelled(tx, approval.id);
  }

  async list(
    query: ApprovalListQuery,
    caller: ApprovalCaller,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<Approval>> {
    const { page, pageSize, awaitingMyDecision, ...rest } = query;
    const { items, total } = await this.repository.findMany({
      ...rest,
      filter,
      awaiting: awaitingMyDecision
        ? { employeeId: caller.employeeId, hr: this.mayDecideHr(caller) }
        : undefined,
      ...toOffsetLimit({ page, pageSize }),
    });
    return buildPage(items, total, { page, pageSize });
  }

  async get(id: string, filter: ScopeFilter): Promise<Approval> {
    const approval = await this.repository.findById(id, filter);
    if (!approval) throw notFound('Approval not found');
    return approval;
  }

  /**
   * Records one decision. Everything runs in one transaction under a row lock: the stage check,
   * the decision, the module's handler and the audit entry. A failure anywhere leaves the
   * approval pending and the module's data untouched.
   */
  async decide(
    id: string,
    outcome: ApprovalOutcome,
    comment: string | undefined,
    caller: ApprovalCaller,
    filter: ScopeFilter,
  ): Promise<Approval> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const action = outcome === 'approved' ? 'approvals.approve' : 'approvals.reject';
    const events = new EventCollector();
    try {
      const approval = await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockById(tx, id);
        // Out of scope looks exactly like missing.
        if (
          !current ||
          !scopeAllows(filter, current.requesterEmployeeId, current.requesterManagerId)
        ) {
          throw notFound('Approval not found');
        }
        if (current.requesterEmployeeId === caller.employeeId) {
          throw forbidden(DENIAL_MESSAGES.own_request);
        }
        if (current.status !== 'pending') {
          // Repeating the decision that already stands is harmless; the opposite one is a conflict.
          if (current.status === outcome) return current;
          throw conflict(DENIAL_MESSAGES.not_pending);
        }
        const denial = denialReason(current, caller);
        if (denial) throw forbidden(DENIAL_MESSAGES[denial]);

        const stage = current.currentStage;
        const isFinal = outcome === 'rejected' || stage === current.stages.length - 1;
        const handler = isFinal ? this.handlers.get(current.subjectType) : undefined;
        if (isFinal && !handler) {
          throw new Error(`No approval handler is registered for '${current.subjectType}'`);
        }
        const status: ApprovalStatus = isFinal ? outcome : 'pending';
        if (isFinal) assertTransition('pending', outcome);
        const saved = await this.repository.saveDecision(tx, id, {
          stage,
          deciderEmployeeId: caller.employeeId,
          outcome,
          comment: comment ?? null,
          status,
          nextStage: isFinal ? stage : stage + 1,
        });
        // Inside the transaction: if the audit entry cannot be written, the decision is undone.
        await audit.record(
          {
            action,
            outcome: 'success',
            entityType: 'approval',
            entityId: id,
            changes: { status: { from: current.status, to: saved.status }, stage },
            metadata: {
              subjectType: current.subjectType,
              subjectId: current.subjectId,
              commentProvided: comment !== undefined,
            },
          },
          { transaction: tx },
        );
        // Last, so a module failure also takes the decision and its audit entry with it.
        await handler?.apply(tx, current, outcome, { employeeId: caller.employeeId });
        events.add({
          type: isFinal ? `approvals.${outcome}` : 'approvals.advanced',
          payload: {
            approvalId: id,
            subjectType: current.subjectType,
            subjectId: current.subjectId,
            requesterEmployeeId: current.requesterEmployeeId,
            stage: currentStageOf(saved),
          },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
        return saved;
      });
      await events.flush(this.platform.events);
      return approval;
    } catch (err) {
      await audit.tryRecord({
        action,
        outcome: err instanceof AppError && err.statusCode === 403 ? 'denied' : 'failure',
        entityType: 'approval',
        entityId: id,
      });
      throw err;
    }
  }

  private mayDecideHr(caller: ApprovalCaller): boolean {
    return caller.roles.includes(ROLES.HR_MANAGER) || caller.roles.includes(ROLES.ADMIN);
  }
}
