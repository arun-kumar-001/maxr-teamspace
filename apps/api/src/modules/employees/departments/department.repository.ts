import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { SortSpec } from '../../../http/pagination';
import { CreateDepartmentDto, DepartmentEntity, UpdateDepartmentDto } from './department.types';

export interface DepartmentFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  search?: string;
  isActive?: boolean;
}

export interface IDepartmentRepository {
  findById(id: string): Promise<DepartmentEntity | null>;
  findByCode(code: string): Promise<DepartmentEntity | null>;
  findMany(params: DepartmentFindManyParams): Promise<{ items: DepartmentEntity[]; total: number }>;
  create(dto: CreateDepartmentDto): Promise<DepartmentEntity>;
  update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentEntity | null>;
  softDelete(id: string): Promise<boolean>;
  hasActiveDesignations(id: string): Promise<boolean>;
  hasActiveEmployees(id: string): Promise<boolean>;
}

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const toEntity = (row: DepartmentRow): DepartmentEntity => ({
  id: row.id,
  name: row.name,
  code: row.code,
  isActive: row.is_active,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date(row.updated_at).toISOString(),
});

/** PostgreSQL implementation using the shared pool. */
export class PgDepartmentRepository implements IDepartmentRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findById(id: string): Promise<DepartmentEntity | null> {
    const res = await this.getPool().query<DepartmentRow>(
      `SELECT id, name, code, is_active, created_at, updated_at
         FROM departments
        WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByCode(code: string): Promise<DepartmentEntity | null> {
    const res = await this.getPool().query<DepartmentRow>(
      `SELECT id, name, code, is_active, created_at, updated_at
         FROM departments
        WHERE LOWER(code) = LOWER($1)`,
      [code],
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findMany(
    params: DepartmentFindManyParams,
  ): Promise<{ items: DepartmentEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      values.push(`%${params.search}%`);
      conditions.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`);
    }

    if (params.isActive !== undefined) {
      values.push(params.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumnMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      createdAt: 'created_at',
    };
    const sortCol = sortColumnMap[params.sort.column] ?? 'created_at';
    const sortDir = params.sort.order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM departments ${whereClause}`,
      values,
    );
    const total = countRes.rows[0]?.count ?? 0;

    const dataValues = [...values, params.limit, params.offset];
    const limitPlaceholder = `$${dataValues.length - 1}`;
    const offsetPlaceholder = `$${dataValues.length}`;

    const res = await this.getPool().query<DepartmentRow>(
      `SELECT id, name, code, is_active, created_at, updated_at
         FROM departments
        ${whereClause}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      dataValues,
    );

    return {
      items: res.rows.map(toEntity),
      total,
    };
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentEntity> {
    const res = await this.getPool().query<DepartmentRow>(
      `INSERT INTO departments (name, code, is_active, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       RETURNING id, name, code, is_active, created_at, updated_at`,
      [dto.name, dto.code],
    );
    return toEntity(res.rows[0]!);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentEntity | null> {
    const updates: string[] = [];
    const values: unknown[] = [id];

    if (dto.name !== undefined) {
      values.push(dto.name);
      updates.push(`name = $${values.length}`);
    }
    if (dto.code !== undefined) {
      values.push(dto.code);
      updates.push(`code = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = NOW()');

    const res = await this.getPool().query<DepartmentRow>(
      `UPDATE departments
          SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING id, name, code, is_active, created_at, updated_at`,
      values,
    );

    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.getPool().query(
      `UPDATE departments
          SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async hasActiveDesignations(id: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM designations
        WHERE department_id = $1 AND is_active = true
        LIMIT 1`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async hasActiveEmployees(id: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM employees
        WHERE department_id = $1 AND status != 'deactivated'
        LIMIT 1`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

/** In-memory implementation for unit testing and fast access tests. */
export class MemoryDepartmentRepository implements IDepartmentRepository {
  private readonly items = new Map<string, DepartmentEntity>();
  private activeDesignationCheck: (deptId: string) => boolean = () => false;
  private activeEmployeeCheck: (deptId: string) => boolean = () => false;

  setActiveDesignationChecker(fn: (deptId: string) => boolean) {
    this.activeDesignationCheck = fn;
  }

  setActiveEmployeeChecker(fn: (deptId: string) => boolean) {
    this.activeEmployeeCheck = fn;
  }

  async findById(id: string): Promise<DepartmentEntity | null> {
    return this.items.get(id) ?? null;
  }

  async findByCode(code: string): Promise<DepartmentEntity | null> {
    const lower = code.toLowerCase();
    return [...this.items.values()].find((d) => d.code.toLowerCase() === lower) ?? null;
  }

  async findMany(
    params: DepartmentFindManyParams,
  ): Promise<{ items: DepartmentEntity[]; total: number }> {
    let rows = [...this.items.values()];
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
      );
    }
    if (params.isActive !== undefined) {
      rows = rows.filter((r) => r.isActive === params.isActive);
    }

    const key = params.sort.column as 'name' | 'code' | 'createdAt';
    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * direction);

    return {
      items: rows.slice(params.offset, params.offset + params.limit),
      total: rows.length,
    };
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentEntity> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      const err = Object.assign(
        new Error('duplicate key value violates unique constraint "departments_code_key"'),
        {
          code: '23505',
        },
      );
      throw err;
    }
    const now = new Date().toISOString();
    const entity: DepartmentEntity = {
      id: randomUUID(),
      name: dto.name,
      code: dto.code,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(entity.id, entity);
    return entity;
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentEntity | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return null;
    }
    if (dto.code && dto.code.toLowerCase() !== existing.code.toLowerCase()) {
      const duplicate = await this.findByCode(dto.code);
      if (duplicate && duplicate.id !== id) {
        const err = Object.assign(
          new Error('duplicate key value violates unique constraint "departments_code_key"'),
          {
            code: '23505',
          },
        );
        throw err;
      }
    }
    const updated: DepartmentEntity = {
      ...existing,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = this.items.get(id);
    if (!existing || !existing.isActive) {
      return false;
    }
    this.items.set(id, { ...existing, isActive: false, updatedAt: new Date().toISOString() });
    return true;
  }

  async hasActiveDesignations(id: string): Promise<boolean> {
    return this.activeDesignationCheck(id);
  }

  async hasActiveEmployees(id: string): Promise<boolean> {
    return this.activeEmployeeCheck(id);
  }
}
