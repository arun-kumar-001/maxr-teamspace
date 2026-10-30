import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../../http/pagination';
import { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import { RequestContext } from '../types';
import { DESIGNATION_SORTABLE_FIELDS } from './designation.schemas';
import { IDesignationRepository } from './designation.repository';
import {
  CreateDesignationDto,
  DesignationEntity,
  DesignationListQuery,
  UpdateDesignationDto,
} from './designation.types';

export type { RequestContext } from '../types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export class DesignationService {
  constructor(
    private readonly repository: IDesignationRepository,
    private readonly platform: Deps,
  ) {}

  async list(query: DesignationListQuery): Promise<PaginatedResponse<DesignationEntity>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sort = resolveSort(query, DESIGNATION_SORTABLE_FIELDS, { column: 'level', order: 'asc' });
    const { items, total } = await this.repository.findMany({
      ...toOffsetLimit({ page, pageSize }),
      sort,
      departmentId: query.departmentId,
      search: query.search,
      isActive: query.isActive,
    });
    return buildPage(items, total, { page, pageSize });
  }

  async getById(id: string): Promise<DesignationEntity> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw notFound('Designation not found');
    }
    return item;
  }

  async create(dto: CreateDesignationDto, ctx: RequestContext): Promise<DesignationEntity> {
    const isDeptActive = await this.repository.isDepartmentActive(dto.departmentId);
    if (!isDeptActive) {
      throw unprocessable('Referenced department does not exist or is inactive');
    }

    const existing = await this.repository.findByCode(dto.code);
    if (existing) {
      throw conflict(`Designation code '${dto.code}' already exists`);
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const created = await this.repository.create(dto);
      await audit.record({
        action: 'designation.create',
        outcome: 'success',
        entityType: 'designation',
        entityId: created.id,
      });

      events.add({
        type: 'designation.created',
        payload: {
          id: created.id,
          title: created.title,
          code: created.code,
          departmentId: created.departmentId,
        },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);

      return created;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'designation.create',
        outcome: 'failure',
        entityType: 'designation',
      });
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateDesignationDto,
    ctx: RequestContext,
  ): Promise<DesignationEntity> {
    await this.getById(id);

    if (dto.departmentId) {
      const isDeptActive = await this.repository.isDepartmentActive(dto.departmentId);
      if (!isDeptActive) {
        throw unprocessable('Referenced department does not exist or is inactive');
      }
    }

    if (dto.code) {
      const existing = await this.repository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw conflict(`Designation code '${dto.code}' already exists`);
      }
    }

    const audit = this.platform.audit.withContext(ctx);
    try {
      const updated = await this.repository.update(id, dto);
      if (!updated) {
        throw notFound('Designation not found');
      }

      await audit.record({
        action: 'designation.update',
        outcome: 'success',
        entityType: 'designation',
        entityId: id,
        changes: { fields: Object.keys(dto) },
      });

      return updated;
    } catch (err) {
      await audit.tryRecord({
        action: 'designation.update',
        outcome: 'failure',
        entityType: 'designation',
        entityId: id,
      });
      throw err;
    }
  }

  async deactivate(id: string, ctx: RequestContext): Promise<void> {
    const item = await this.getById(id);
    if (!item.isActive) {
      throw unprocessable('Designation is already inactive');
    }

    const hasEmployees = await this.repository.hasActiveEmployees(id);
    if (hasEmployees) {
      throw conflict('Cannot deactivate designation with active employees');
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const ok = await this.repository.softDelete(id);
      if (!ok) {
        throw notFound('Designation not found');
      }

      await audit.record({
        action: 'designation.deactivate',
        outcome: 'success',
        entityType: 'designation',
        entityId: id,
      });

      events.add({
        type: 'designation.deactivated',
        payload: { id },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'designation.deactivate',
        outcome: 'failure',
        entityType: 'designation',
        entityId: id,
      });
      throw err;
    }
  }
}
