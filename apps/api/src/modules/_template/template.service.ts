import { PaginatedResponse } from '@maxr/shared';
import { notFound, unprocessable } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
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
export class TemplateService {
  constructor(private readonly repository: ITemplateRepository) {}

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

  create(dto: CreateTemplateDto, actorId: string): Promise<TemplateEntity> {
    return this.repository.create(dto, actorId);
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    visibleOwnerIds?: string[],
  ): Promise<TemplateEntity> {
    await this.getById(id, visibleOwnerIds);
    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw notFound('Template not found');
    }
    return updated;
  }

  async deactivate(id: string, visibleOwnerIds?: string[]): Promise<void> {
    const item = await this.getById(id, visibleOwnerIds);
    if (!item.isActive) {
      // Example of a business-rule violation: 422, not 400.
      throw unprocessable('Template is already inactive');
    }
    await this.repository.softDelete(id);
  }
}
