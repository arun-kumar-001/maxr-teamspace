import { randomUUID } from 'crypto';
import { SortSpec } from '../../http/pagination';
import { ScopeFilter, scopeAllows } from '../rbac';
import { CreateTemplateDto, TemplateEntity, UpdateTemplateDto } from './template.types';

export interface TemplateFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  search?: string;
  isActive?: boolean;
}

/**
 * Database access contract. Real modules implement it with parameterised SQL, apply the
 * scope filter inside the query (never after fetching) and use `toOffsetLimit()` / the
 * `resolveSort()` column allow-list for paging and ordering.
 *
 * `scope` is required on every read: it comes from `requirePermission` (modules/rbac) and a SQL
 * repository turns it into a WHERE condition with `scopeToSql`. The owner is an employee id.
 */
export interface ITemplateRepository {
  findById(id: string, scope: ScopeFilter): Promise<TemplateEntity | null>;
  findMany(
    params: TemplateFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: TemplateEntity[]; total: number }>;
  create(dto: CreateTemplateDto, ownerId: string): Promise<TemplateEntity>;
  update(id: string, dto: UpdateTemplateDto): Promise<TemplateEntity | null>;
  softDelete(id: string): Promise<boolean>;
}

/** PostgreSQL unique_violation, as the `pg` driver would raise it. */
function uniqueViolation(): Error {
  return Object.assign(
    new Error('duplicate key value violates unique constraint "templates_name_key"'),
    {
      code: '23505',
    },
  );
}

/** In-memory reference implementation used by the sample module and its tests. */
export class TemplateRepository implements ITemplateRepository {
  private readonly items = new Map<string, TemplateEntity>();

  /** `managerOf` stands in for the employees table's manager_id when the scope is a team. */
  constructor(private readonly managerOf: (employeeId: string) => string | null = () => null) {}

  private inScope(item: TemplateEntity, scope: ScopeFilter): boolean {
    return scopeAllows(scope, item.ownerId, this.managerOf(item.ownerId));
  }

  private nameTaken(name: string, exceptId?: string): boolean {
    const wanted = name.toLowerCase();
    return [...this.items.values()].some(
      (i) => i.id !== exceptId && i.name.toLowerCase() === wanted,
    );
  }

  async findById(id: string, scope: ScopeFilter): Promise<TemplateEntity | null> {
    const item = this.items.get(id);
    // Out of scope looks exactly like "does not exist" (no existence leak).
    return item && this.inScope(item, scope) ? item : null;
  }

  async findMany(params: TemplateFindManyParams, scope: ScopeFilter) {
    let rows = [...this.items.values()].filter((r) => this.inScope(r, scope));
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (params.isActive !== undefined) {
      rows = rows.filter((r) => r.isActive === params.isActive);
    }

    const key = params.sort.column as 'name' | 'createdAt';
    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * direction);

    return { items: rows.slice(params.offset, params.offset + params.limit), total: rows.length };
  }

  async create(dto: CreateTemplateDto, ownerId: string): Promise<TemplateEntity> {
    if (this.nameTaken(dto.name)) {
      throw uniqueViolation();
    }
    const now = new Date().toISOString();
    const entity: TemplateEntity = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description ?? null,
      ownerId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(entity.id, entity);
    return entity;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateEntity | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return null;
    }
    if (dto.name !== undefined && this.nameTaken(dto.name, id)) {
      throw uniqueViolation();
    }
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
    if (!existing) {
      return false;
    }
    this.items.set(id, { ...existing, isActive: false, updatedAt: new Date().toISOString() });
    return true;
  }
}
