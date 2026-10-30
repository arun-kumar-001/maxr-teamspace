import { randomUUID } from 'crypto';
import { conflict } from '../../http/errors';
import { ScopeFilter, scopeAllows } from '../rbac';
import { AttendanceLocation, AttendanceRecord, CheckInDto } from './attendance.types';
import { AttendanceFindManyParams, IAttendanceRepository } from './attendance.repository';

export function uniqueViolation(constraint = 'idx_attendance_single_open_session'): Error {
  return conflict(`duplicate key value violates unique constraint "${constraint}"`);
}

/**
 * In-memory reference repository for attendance operations (used for unit tests).
 * Enforces the partial unique index guarantee (at most one open session per employee)
 * and full RBAC record scoping using `scopeAllows`.
 */
export class InMemoryAttendanceRepository implements IAttendanceRepository {
  private readonly items = new Map<string, AttendanceRecord>();
  private readonly activeEmployees = new Set<string>();

  /** `managerOf` returns the manager employee ID for a given employee ID. */
  constructor(
    private readonly managerOf: (employeeId: string) => string | null = () => null,
    initialActiveEmployees: string[] = [],
  ) {
    for (const id of initialActiveEmployees) {
      this.activeEmployees.add(id);
    }
  }

  setEmployeeActive(employeeId: string, active: boolean): void {
    if (active) {
      this.activeEmployees.add(employeeId);
    } else {
      this.activeEmployees.delete(employeeId);
    }
  }

  async isEmployeeActive(employeeId: string): Promise<boolean> {
    if (this.activeEmployees.size === 0) return true;
    return this.activeEmployees.has(employeeId);
  }

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
    checkOutTime: string,
    durationMinutes: number,
    notes?: string,
  ): Promise<AttendanceRecord | null> {
    const record = this.items.get(sessionId);
    if (!record || record.checkOutTime !== null) {
      return null;
    }

    const updated: AttendanceRecord = {
      ...record,
      checkOutTime,
      durationMinutes,
      notes: notes ?? record.notes,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(sessionId, updated);
    return updated;
  }

  async findMany(
    params: AttendanceFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: AttendanceRecord[]; total: number }> {
    let all = [...this.items.values()].filter((item) => this.inScope(item, scope));

    if (params.employeeId) {
      all = all.filter((i) => i.employeeId === params.employeeId);
    }
    if (params.startDate) {
      all = all.filter((i) => i.workDate >= params.startDate!);
    }
    if (params.endDate) {
      all = all.filter((i) => i.workDate <= params.endDate!);
    }
    if (params.status) {
      all = all.filter((i) => i.status === params.status);
    }

    const total = all.length;
    const sortField = params.sort.column as keyof AttendanceRecord;
    const isAsc = params.sort.order === 'asc';

    all.sort((a, b) => {
      const aVal = String(a[sortField] ?? '');
      const bVal = String(b[sortField] ?? '');
      return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    const paginated = all.slice(params.offset, params.offset + params.limit);
    return { items: paginated, total };
  }

  async findById(id: string, scope: ScopeFilter): Promise<AttendanceRecord | null> {
    const record = this.items.get(id);
    if (!record || !this.inScope(record, scope)) {
      return null;
    }
    return record;
  }
}

// Backward compatibility alias for tests
export { InMemoryAttendanceRepository as AttendanceRepository };
