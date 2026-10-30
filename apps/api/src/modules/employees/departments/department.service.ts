import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../../http/pagination';
import { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import { RequestContext } from '../types';
import { DEPARTMENT_SORTABLE_FIELDS } from './department.schemas';
import { IDepartmentRepository } from './department.repository';
import {
  CreateDepartmentDto,
  DepartmentEntity,
  DepartmentListQuery,
  UpdateDepartmentDto,
} from './department.types';

export type { RequestContext } from '../types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export class DepartmentService {
  constructor(
    private readonly repository: IDepartmentRepository,
    private readonly platform: Deps,
  ) {}

  async list(query: DepartmentListQuery): Promise<PaginatedResponse<DepartmentEntity>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sort = resolveSort(query, DEPARTMENT_SORTABLE_FIELDS, { column: 'name', order: 'asc' });
    const { items, total } = await this.repository.findMany({
      ...toOffsetLimit({ page, pageSize }),
      sort,
      search: query.search,
      isActive: query.isActive,
    });
    return buildPage(items, total, { page, pageSize });
  }

  async getById(id: string): Promise<DepartmentEntity> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw notFound('Department not found');
    }
    return item;
  }

  async create(dto: CreateDepartmentDto, ctx: RequestContext): Promise<DepartmentEntity> {
    const existing = await this.repository.findByCode(dto.code);
    if (existing) {
      throw conflict(`Department code '${dto.code}' already exists`);
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const created = await this.repository.create(dto);
      await audit.record({
        action: 'department.create',
        outcome: 'success',
        entityType: 'department',
        entityId: created.id,
      });

      events.add({
        type: 'department.created',
        payload: { id: created.id, name: created.name, code: created.code },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);

      return created;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'department.create',
        outcome: 'failure',
        entityType: 'department',
      });
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    ctx: RequestContext,
  ): Promise<DepartmentEntity> {
    await this.getById(id);

    if (dto.code) {
      const existing = await this.repository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw conflict(`Department code '${dto.code}' already exists`);
      }
    }

    const audit = this.platform.audit.withContext(ctx);
    try {
      const updated = await this.repository.update(id, dto);
      if (!updated) {
        throw notFound('Department not found');
      }

      await audit.record({
        action: 'department.update',
        outcome: 'success',
        entityType: 'department',
        entityId: id,
        changes: { fields: Object.keys(dto) },
      });

      return updated;
    } catch (err) {
      await audit.tryRecord({
        action: 'department.update',
        outcome: 'failure',
        entityType: 'department',
        entityId: id,
      });
      throw err;
    }
  }

  async deactivate(id: string, ctx: RequestContext): Promise<void> {
    const item = await this.getById(id);
    if (!item.isActive) {
      throw unprocessable('Department is already inactive');
    }

    // In-use guard 1: active designations
    const hasDesignations = await this.repository.hasActiveDesignations(id);
    if (hasDesignations) {
      throw conflict('Cannot deactivate department with active designations');
    }

    // In-use guard 2: active employees
    const hasEmployees = await this.repository.hasActiveEmployees(id);
    if (hasEmployees) {
      throw conflict('Cannot deactivate department with active employees');
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const ok = await this.repository.softDelete(id);
      if (!ok) {
        throw notFound('Department not found');
      }

      await audit.record({
        action: 'department.deactivate',
        outcome: 'success',
        entityType: 'department',
        entityId: id,
      });

      events.add({
        type: 'department.deactivated',
        payload: { id },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'department.deactivate',
        outcome: 'failure',
        entityType: 'department',
        entityId: id,
      });
      throw err;
    }
  }
}
