import { randomUUID } from 'crypto';
import { SortSpec } from '../../http/pagination';
import { ScopeFilter, scopeAllows } from '../rbac';
import { AttendanceLocation, AttendanceRecord, CheckInDto } from './attendance.types';

export interface AttendanceFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface IAttendanceRepository {
  findActiveSession(employeeId: string): Promise<AttendanceRecord | null>;
  findTodaySessions(employeeId: string, workDate: string): Promise<AttendanceRecord[]>;
  createCheckIn(
    employeeId: string,
    workDate: string,
    dto: CheckInDto,
    checkInTime?: string,
  ): Promise<AttendanceRecord>;
  createCheckOut(
    sessionId: string,
    checkOutTime: string,
    durationMinutes: number,
    notes?: string,
  ): Promise<AttendanceRecord | null>;
  findMany(
    params: AttendanceFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: AttendanceRecord[]; total: number }>;
  findById(id: string, scope: ScopeFilter): Promise<AttendanceRecord | null>;
}

export function uniqueViolation(constraint = 'idx_attendance_single_open_session'): Error {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: '23505', constraint },
  );
}

/**
 * In-memory reference repository for attendance operations.
 * Enforces the partial unique index guarantee (at most one open session per employee)
 * and full RBAC record scoping using `scopeAllows`.
 */
export class AttendanceRepository implements IAttendanceRepository {
  private readonly items = new Map<string, AttendanceRecord>();

  /** `managerOf` returns the manager employee ID for a given employee ID. */
  constructor(private readonly managerOf: (employeeId: string) => string | null = () => null) {}

  private inScope(item: AttendanceRecord, scope: ScopeFilter): boolean {
    return scopeAllows(scope, item.employeeId, this.managerOf(item.employeeId));
  }

  async findActiveSession(employeeId: string): Promise<AttendanceRecord | null> {
    for (const record of this.items.values()) {
      if (record.employeeId === employeeId && record.checkOutTime === null) {
        return record;
      }
    }
    return null;
  }

  async findTodaySessions(employeeId: string, workDate: string): Promise<AttendanceRecord[]> {
    const results: AttendanceRecord[] = [];
    for (const record of this.items.values()) {
      if (record.employeeId === employeeId && record.workDate === workDate) {
        results.push(record);
      }
    }
    return results.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
  }

  async createCheckIn(
    employeeId: string,
    workDate: string,
    dto: CheckInDto,
    checkInTime = new Date().toISOString(),
  ): Promise<AttendanceRecord> {
    // Enforce partial unique index: at most one open session per employee
    const active = await this.findActiveSession(employeeId);
    if (active) {
      throw uniqueViolation();
    }

    const now = new Date().toISOString();
    const record: AttendanceRecord = {
      id: randomUUID(),
      employeeId,
      workDate,
      checkInTime,
      checkOutTime: null,
      durationMinutes: null,
      status: 'PRESENT',
      location: (dto.location as AttendanceLocation) ?? null,
      notes: dto.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.items.set(record.id, record);
    return record;
  }

  async createCheckOut(
    sessionId: string,
    checkOutTime = new Date().toISOString(),
    durationMinutes: number,
    notes?: string,
  ): Promise<AttendanceRecord | null> {
    const existing = this.items.get(sessionId);
    if (!existing || existing.checkOutTime !== null) {
      return null;
    }

    const updated: AttendanceRecord = {
      ...existing,
      checkOutTime,
      durationMinutes,
      notes: notes ?? existing.notes,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(sessionId, updated);
    return updated;
  }

  async findById(id: string, scope: ScopeFilter): Promise<AttendanceRecord | null> {
    const record = this.items.get(id);
    if (!record || !this.inScope(record, scope)) {
      return null;
    }
    return record;
  }

  async findMany(
    params: AttendanceFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: AttendanceRecord[]; total: number }> {
    let rows = [...this.items.values()].filter((r) => this.inScope(r, scope));

    if (params.employeeId) {
      rows = rows.filter((r) => r.employeeId === params.employeeId);
    }
    if (params.startDate) {
      rows = rows.filter((r) => r.workDate >= params.startDate!);
    }
    if (params.endDate) {
      rows = rows.filter((r) => r.workDate <= params.endDate!);
    }
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }

    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const aVal = a[params.sort.column as keyof AttendanceRecord] ?? '';
      const bVal = b[params.sort.column as keyof AttendanceRecord] ?? '';
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * direction;
    });

    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);

    return { items, total };
  }
}

