import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { SortSpec } from '../../../http/pagination';
import { CreateDesignationDto, DesignationEntity, UpdateDesignationDto } from './designation.types';

export interface DesignationFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  departmentId?: string;
  search?: string;
  isActive?: boolean;
}

export interface IDesignationRepository {
  findById(id: string): Promise<DesignationEntity | null>;
  findByCode(code: string): Promise<DesignationEntity | null>;
  findMany(
    params: DesignationFindManyParams,
  ): Promise<{ items: DesignationEntity[]; total: number }>;
  create(dto: CreateDesignationDto): Promise<DesignationEntity>;
  update(id: string, dto: UpdateDesignationDto): Promise<DesignationEntity | null>;
  softDelete(id: string): Promise<boolean>;
  hasActiveEmployees(id: string): Promise<boolean>;
  isDepartmentActive(departmentId: string): Promise<boolean>;
}

interface DesignationRow {
  id: string;
  department_id: string;
  title: string;
  code: string;
  level: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const toEntity = (row: DesignationRow): DesignationEntity => ({
  id: row.id,
  departmentId: row.department_id,
  title: row.title,
  code: row.code,
  level: row.level,
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

const escapeLikePattern = (input: string): string => input.replace(/([\\%_])/g, '\\$1');

export class PgDesignationRepository implements IDesignationRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findById(id: string): Promise<DesignationEntity | null> {
    const res = await this.getPool().query<DesignationRow>(
      `SELECT id, department_id, title, code, level, is_active, created_at, updated_at
         FROM designations
        WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByCode(code: string): Promise<DesignationEntity | null> {
    const res = await this.getPool().query<DesignationRow>(
      `SELECT id, department_id, title, code, level, is_active, created_at, updated_at
         FROM designations
        WHERE LOWER(code) = LOWER($1)`,
      [code],
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findMany(
    params: DesignationFindManyParams,
  ): Promise<{ items: DesignationEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.departmentId) {
      values.push(params.departmentId);
      conditions.push(`department_id = $${values.length}`);
    }

    if (params.search) {
      const escaped = escapeLikePattern(params.search);
      values.push(`%${escaped}%`);
      conditions.push(
        `(title ILIKE $${values.length} ESCAPE '\\' OR code ILIKE $${values.length} ESCAPE '\\')`,
      );
    }

    if (params.isActive !== undefined) {
      values.push(params.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumnMap: Record<string, string> = {
      title: 'title',
      code: 'code',
      level: 'level',
      createdAt: 'created_at',
    };
    const sortCol = sortColumnMap[params.sort.column] ?? 'level';
    const sortDir = params.sort.order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM designations ${whereClause}`,
      values,
    );
    const total = countRes.rows[0]?.count ?? 0;

    const dataValues = [...values, params.limit, params.offset];
    const limitPlaceholder = `$${dataValues.length - 1}`;
    const offsetPlaceholder = `$${dataValues.length}`;

    const res = await this.getPool().query<DesignationRow>(
      `SELECT id, department_id, title, code, level, is_active, created_at, updated_at
         FROM designations
        ${whereClause}
        ORDER BY ${sortCol} ${sortDir}, id ASC
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      dataValues,
    );

    return {
      items: res.rows.map(toEntity),
      total,
    };
  }

  async create(dto: CreateDesignationDto): Promise<DesignationEntity> {
    const res = await this.getPool().query<DesignationRow>(
      `INSERT INTO designations (department_id, title, code, level, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, department_id, title, code, level, is_active, created_at, updated_at`,
      [dto.departmentId, dto.title, dto.code, dto.level],
    );
    return toEntity(res.rows[0]!);
  }

  async update(id: string, dto: UpdateDesignationDto): Promise<DesignationEntity | null> {
    const updates: string[] = [];
    const values: unknown[] = [id];

    if (dto.departmentId !== undefined) {
      values.push(dto.departmentId);
      updates.push(`department_id = $${values.length}`);
    }
    if (dto.title !== undefined) {
      values.push(dto.title);
      updates.push(`title = $${values.length}`);
    }
    if (dto.code !== undefined) {
      values.push(dto.code);
      updates.push(`code = $${values.length}`);
    }
    if (dto.level !== undefined) {
      values.push(dto.level);
      updates.push(`level = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = NOW()');

    const res = await this.getPool().query<DesignationRow>(
      `UPDATE designations
          SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING id, department_id, title, code, level, is_active, created_at, updated_at`,
      values,
    );

    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.getPool().query(
      `UPDATE designations
          SET is_active = false, updated_at = NOW()
        WHERE id = $1
          AND is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM employees
             WHERE designation_id = $1 AND status != 'deactivated'
          )`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async hasActiveEmployees(id: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM employees
        WHERE designation_id = $1 AND status != 'deactivated'
        LIMIT 1`,
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async isDepartmentActive(departmentId: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM departments
        WHERE id = $1 AND is_active = true
        LIMIT 1`,
      [departmentId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

export class MemoryDesignationRepository implements IDesignationRepository {
  private readonly items = new Map<string, DesignationEntity>();
  private activeEmployeeCheck: (desigId: string) => boolean = () => false;
  private activeDepartmentCheck: (deptId: string) => boolean = () => true;

  setActiveEmployeeChecker(fn: (desigId: string) => boolean) {
    this.activeEmployeeCheck = fn;
  }

  setActiveDepartmentChecker(fn: (deptId: string) => boolean) {
    this.activeDepartmentCheck = fn;
  }

  async findById(id: string): Promise<DesignationEntity | null> {
    return this.items.get(id) ?? null;
  }

  async findByCode(code: string): Promise<DesignationEntity | null> {
    const lower = code.toLowerCase();
    return [...this.items.values()].find((d) => d.code.toLowerCase() === lower) ?? null;
  }

  async findMany(
    params: DesignationFindManyParams,
  ): Promise<{ items: DesignationEntity[]; total: number }> {
    let rows = [...this.items.values()];
    if (params.departmentId) {
      rows = rows.filter((r) => r.departmentId === params.departmentId);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(
        (r) => r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
      );
    }
    if (params.isActive !== undefined) {
      rows = rows.filter((r) => r.isActive === params.isActive);
    }

    const key = params.sort.column as 'title' | 'code' | 'level' | 'createdAt';
    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (a[key] < b[key]) return -1 * direction;
      if (a[key] > b[key]) return 1 * direction;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return {
      items: rows.slice(params.offset, params.offset + params.limit),
      total: rows.length,
    };
  }

  async create(dto: CreateDesignationDto): Promise<DesignationEntity> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      const err = Object.assign(
        new Error('duplicate key value violates unique constraint "designations_code_key"'),
        {
          code: '23505',
        },
      );
      throw err;
    }
    const now = new Date().toISOString();
    const entity: DesignationEntity = {
      id: randomUUID(),
      departmentId: dto.departmentId,
      title: dto.title,
      code: dto.code,
      level: dto.level,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(entity.id, entity);
    return entity;
  }

  async update(id: string, dto: UpdateDesignationDto): Promise<DesignationEntity | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return null;
    }
    if (dto.code && dto.code.toLowerCase() !== existing.code.toLowerCase()) {
      const duplicate = await this.findByCode(dto.code);
      if (duplicate && duplicate.id !== id) {
        const err = Object.assign(
          new Error('duplicate key value violates unique constraint "designations_code_key"'),
          {
            code: '23505',
          },
        );
        throw err;
      }
    }
    const updated: DesignationEntity = {
      ...existing,
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.level !== undefined ? { level: dto.level } : {}),
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
    if (this.activeEmployeeCheck(id)) {
      return false;
    }
    this.items.set(id, { ...existing, isActive: false, updatedAt: new Date().toISOString() });
    return true;
  }

  async hasActiveEmployees(id: string): Promise<boolean> {
    return this.activeEmployeeCheck(id);
  }

  async isDepartmentActive(departmentId: string): Promise<boolean> {
    return this.activeDepartmentCheck(departmentId);
  }
}
