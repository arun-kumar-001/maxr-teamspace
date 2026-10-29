import { PaginatedResponse } from '@maxr/shared';
import { notFound, unprocessable } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
import { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { SORTABLE_FIELDS } from './template.schemas';
import { ITemplateRepository } from './template.repository';
import {
  CreateTemplateDto,
  TemplateEntity,
  TemplateListQuery,
  UpdateTemplateDto,
} from './template.types';

/**
 * Business rules live here: no Express types, no SQL. Errors are thrown as AppError via the
 * factories in http/errors; duplicate-name conflicts surface from the repository as a
 * PostgreSQL 23505 error and are translated to 409 by the central error handler.
 */
/** Who is doing this and for which request. Built from the HTTP request by the controller. */
export interface RequestContext {
  actorId: string;
  requestId?: string;
}

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export class TemplateService {
  constructor(
    private readonly repository: ITemplateRepository,
    private readonly platform: Deps,
  ) {}

  async list(
    query: TemplateListQuery,
    visibleOwnerIds?: string[],
  ): Promise<PaginatedResponse<TemplateEntity>> {
    const sort = resolveSort(query, SORTABLE_FIELDS, { column: 'createdAt', order: 'desc' });
    const { items, total } = await this.repository.findMany(
      { ...toOffsetLimit(query), sort, search: query.search, isActive: query.isActive },
      visibleOwnerIds,
    );
    return buildPage(items, total, query);
  }

  async getById(id: string, visibleOwnerIds?: string[]): Promise<TemplateEntity> {
    const item = await this.repository.findById(id, visibleOwnerIds);
    if (!item) {
      // 404 (not 403) for out-of-scope records, per AGENTS.md §5.
      throw notFound('Template not found');
    }
    return item;
  }

  /**
   * Pattern for every write: do the work, write the audit entry, and announce the event only
   * AFTER the work is committed (EventCollector), so nothing is announced for rolled-back work.
   */
  async create(dto: CreateTemplateDto, ctx: RequestContext): Promise<TemplateEntity> {
    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();
    try {
      const created = await this.repository.create(dto, ctx.actorId); // <- transaction commits here
      await audit.record({
        action: 'template.create',
        outcome: 'success',
        entityType: 'template',
        entityId: created.id,
      });
      events.add({
        type: 'template.created',
        payload: { id: created.id },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);
      return created;
    } catch (err) {
      events.discard();
      // A failed attempt is worth an audit line too; it must not hide the real error.
      await audit.tryRecord({
        action: 'template.create',
        outcome: 'failure',
        entityType: 'template',
      });
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    ctx: RequestContext,
    visibleOwnerIds?: string[],
  ): Promise<TemplateEntity> {
    await this.getById(id, visibleOwnerIds);
    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw notFound('Template not found');
    }
    // Field names only: values can be personal data.
    await this.platform.audit.withContext(ctx).record({
      action: 'template.update',
      outcome: 'success',
      entityType: 'template',
      entityId: id,
      changes: { fields: Object.keys(dto) },
    });
    return updated;
  }

  async deactivate(id: string, ctx: RequestContext, visibleOwnerIds?: string[]): Promise<void> {
    const item = await this.getById(id, visibleOwnerIds);
    if (!item.isActive) {
      // Example of a business-rule violation: 422, not 400.
      throw unprocessable('Template is already inactive');
    }
    await this.repository.softDelete(id);
    await this.platform.audit.withContext(ctx).record({
      action: 'template.deactivate',
      outcome: 'success',
      entityType: 'template',
      entityId: id,
    });
  }
}
