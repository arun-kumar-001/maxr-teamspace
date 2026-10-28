import {
  TemplateEntity,
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateFilterQuery,
} from './template.types';
import { PaginatedResponse } from '@maxr/shared';

/**
 * Template Repository Interface
 * Defines database access contracts. Implemented using parameterized SQL.
 * Never execute SQL in controllers or services.
 */
export interface ITemplateRepository {
  findById(id: string, scopeFilter?: string[]): Promise<TemplateEntity | null>;
  findMany(
    filter: TemplateFilterQuery,
    scopeFilter?: string[],
  ): Promise<PaginatedResponse<TemplateEntity>>;
  create(dto: CreateTemplateDto, createdByUserId: string): Promise<TemplateEntity>;
  update(id: string, dto: UpdateTemplateDto): Promise<TemplateEntity | null>;
  softDelete(id: string): Promise<boolean>;
}

/**
 * In-Memory / SQL Template Repository Reference Implementation
 */
export class TemplateRepository implements ITemplateRepository {
  private items: Map<string, TemplateEntity> = new Map();

  async findById(id: string, scopeFilter?: string[]): Promise<TemplateEntity | null> {
    const item = this.items.get(id);
    if (!item) return null;

    // Apply scope filter at the repository layer (e.g. WHERE team_id IN (...))
    if (scopeFilter && scopeFilter.length > 0 && !scopeFilter.includes(item.scope)) {
      return null; // Out of scope -> return null so service maps to 404 (no existence leak)
    }

    return item;
  }

  async findMany(
    filter: TemplateFilterQuery,
    scopeFilter?: string[],
  ): Promise<PaginatedResponse<TemplateEntity>> {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize = filter.pageSize && filter.pageSize > 0 ? Math.min(filter.pageSize, 100) : 20;

    let all = Array.from(this.items.values());

    // Scope filter applied at repository level
    if (scopeFilter && scopeFilter.length > 0) {
      all = all.filter((i) => scopeFilter.includes(i.scope));
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      all = all.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (filter.isActive !== undefined) {
      all = all.filter((i) => i.isActive === filter.isActive);
    }

    const total = all.length;
    const start = (page - 1) * pageSize;
    const paged = all.slice(start, start + pageSize);

    return {
      data: paged,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async create(dto: CreateTemplateDto, createdByUserId: string): Promise<TemplateEntity> {
    const now = new Date().toISOString();
    const id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const entity: TemplateEntity = {
      id,
      name: dto.name,
      description: dto.description || null,
      scope: createdByUserId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, entity);
    return entity;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateEntity | null> {
    const existing = this.items.get(id);
    if (!existing) return null;

    const updated: TemplateEntity = {
      ...existing,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = this.items.get(id);
    if (!existing) return false;

    this.items.set(id, {
      ...existing,
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }
}
