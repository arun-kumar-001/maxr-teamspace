import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
import { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { IApprovalsRepository } from './approvals.repository';
import { SORTABLE_APPROVAL_FIELDS } from './approvals.schemas';
import {
  Approval,
  ApprovalSubjectType,
  CreateApprovalDto,
  DecisionDto,
  IApprovalSubjectHandler,
  ListApprovalsQuery,
} from './approvals.types';

export interface RequestContext {
  actorId: string;
  actorRole?: string;
  requestId?: string;
}

type PlatformDeps = Pick<PlatformServices, 'audit' | 'events'>;

export class ApprovalsService {
  private readonly handlers = new Map<ApprovalSubjectType, IApprovalSubjectHandler>();

  constructor(
    private readonly repository: IApprovalsRepository,
    private readonly platform: PlatformDeps,
  ) {}

  registerHandler(subjectType: ApprovalSubjectType, handler: IApprovalSubjectHandler): void {
    this.handlers.set(subjectType, handler);
  }

  async getById(id: string): Promise<Approval> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw notFound('Approval request not found');
    }
    return item;
  }

  async create(dto: CreateApprovalDto, ctx: RequestContext): Promise<Approval> {
    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const created = await this.repository.create(dto);

      await audit.record({
        action: 'approval.create',
        outcome: 'success',
        entityType: 'approval',
        entityId: created.id,
      });

      events.add({
        type: 'approval.created',
        payload: { id: created.id, subjectType: created.subjectType, subjectId: created.subjectId },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return created;
    } catch (err) {
      events.discard();
      throw err;
    }
  }

  async approve(
    id: string,
    approverId: string,
    dto: DecisionDto,
    ctx: RequestContext,
  ): Promise<Approval> {
    const existing = await this.getById(id);

    // Business Invariant: No Self-Approval (AGENTS.md §9)
    if (existing.requesterId === approverId) {
      throw unprocessable('Self-approval is forbidden', [
        {
          field: 'approverId',
          message: 'Requester cannot approve their own request',
          rule: 'no_self_approval',
        },
      ]);
    }

    if (existing.status !== 'PENDING') {
      throw conflict(`Approval request has already been decided (${existing.status})`);
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    // Trigger subject handler if registered
    const handler = this.handlers.get(existing.subjectType);
    if (handler) {
      await handler.onApprove(existing.subjectId, approverId, dto.comment);
    }

    const updated = await this.repository.updateDecision(id, approverId, 'APPROVED', dto.comment);
    if (!updated) {
      throw conflict('Concurrent update detected on approval request');
    }

    await audit.record({
      action: 'approval.approve',
      outcome: 'success',
      entityType: 'approval',
      entityId: updated.id,
      changes: { status: 'APPROVED', approverId },
    });

    events.add({
      type: 'approval.approved',
      payload: { id: updated.id, subjectType: updated.subjectType, subjectId: updated.subjectId },
      actorId: ctx.actorId,
      requestId: ctx.requestId,
    });

    await events.flush(this.platform.events);
    return updated;
  }

  async reject(
    id: string,
    approverId: string,
    dto: DecisionDto,
    ctx: RequestContext,
  ): Promise<Approval> {
    const existing = await this.getById(id);

    // Business Invariant: No Self-Decision
    if (existing.requesterId === approverId) {
      throw unprocessable('Self-rejection is forbidden', [
        {
          field: 'approverId',
          message: 'Requester cannot reject their own request',
          rule: 'no_self_rejection',
        },
      ]);
    }

    if (existing.status !== 'PENDING') {
      throw conflict(`Approval request has already been decided (${existing.status})`);
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    const handler = this.handlers.get(existing.subjectType);
    if (handler) {
      await handler.onReject(existing.subjectId, approverId, dto.comment);
    }

    const updated = await this.repository.updateDecision(id, approverId, 'REJECTED', dto.comment);
    if (!updated) {
      throw conflict('Concurrent update detected on approval request');
    }

    await audit.record({
      action: 'approval.reject',
      outcome: 'success',
      entityType: 'approval',
      entityId: updated.id,
      changes: { status: 'REJECTED', approverId },
    });

    events.add({
      type: 'approval.rejected',
      payload: { id: updated.id, subjectType: updated.subjectType, subjectId: updated.subjectId },
      actorId: ctx.actorId,
      requestId: ctx.requestId,
    });

    await events.flush(this.platform.events);
    return updated;
  }

  async listInbox(
    query: ListApprovalsQuery,
    scopeRequesterIds?: string[],
  ): Promise<PaginatedResponse<Approval>> {
    const sort = resolveSort(query, SORTABLE_APPROVAL_FIELDS, {
      column: 'createdAt',
      order: 'desc',
    });
    const { items, total } = await this.repository.findMany(
      {
        ...toOffsetLimit(query),
        sort,
        status: query.status,
        subjectType: query.subjectType,
      },
      scopeRequesterIds,
    );
    return buildPage(items, total, query);
  }
}
