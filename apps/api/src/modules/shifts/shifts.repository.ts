import { randomUUID } from 'crypto';
import { SortSpec } from '../../http/pagination';
import {
  AssignEmployeeShiftDto,
  AttendancePolicy,
  CreateShiftDto,
  EmployeeShift,
  Shift,
  UpdateAttendancePolicyDto,
  UpdateShiftDto,
} from './shifts.types';

export interface ShiftFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  isActive?: boolean;
}

export interface IShiftsRepository {
  findShifts(params: ShiftFindManyParams): Promise<{ items: Shift[]; total: number }>;
  findShiftById(id: string): Promise<Shift | null>;
  findShiftByCode(code: string): Promise<Shift | null>;
  createShift(dto: CreateShiftDto): Promise<Shift>;
  updateShift(id: string, dto: UpdateShiftDto): Promise<Shift | null>;
  assignEmployeeShift(dto: AssignEmployeeShiftDto): Promise<EmployeeShift>;
  findEmployeeShifts(employeeId: string): Promise<EmployeeShift[]>;
  getAttendancePolicy(): Promise<AttendancePolicy>;
  updateAttendancePolicy(dto: UpdateAttendancePolicyDto): Promise<AttendancePolicy>;
}

export class ShiftsRepository implements IShiftsRepository {
  private readonly shifts = new Map<string, Shift>();
  private readonly employeeShifts = new Map<string, EmployeeShift>();
  private policy: AttendancePolicy = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Standard Working Policy',
    gracePeriodMinutes: 15,
    halfDayThresholdMinutes: 240,
    fullDayThresholdMinutes: 480,
    timezone: 'UTC',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  constructor() {
    // Seed default standard shift
    const defaultShift: Shift = {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'General Morning Shift',
      code: 'GEN-01',
      startTime: '09:00:00',
      endTime: '17:30:00',
      breakMinutes: 60,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.shifts.set(defaultShift.id, defaultShift);
  }

  async findShifts(params: ShiftFindManyParams): Promise<{ items: Shift[]; total: number }> {
    let rows = [...this.shifts.values()];

    if (params.isActive !== undefined) {
      rows = rows.filter((s) => s.isActive === params.isActive);
    }

    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const aVal = a[params.sort.column as keyof Shift] ?? '';
      const bVal = b[params.sort.column as keyof Shift] ?? '';
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * direction;
    });

    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total };
  }

  async findShiftById(id: string): Promise<Shift | null> {
    return this.shifts.get(id) ?? null;
  }

  async findShiftByCode(code: string): Promise<Shift | null> {
    for (const shift of this.shifts.values()) {
      if (shift.code.toLowerCase() === code.toLowerCase()) {
        return shift;
      }
    }
    return null;
  }

  async createShift(dto: CreateShiftDto): Promise<Shift> {
    const now = new Date().toISOString();
    const shift: Shift = {
      id: randomUUID(),
      name: dto.name,
      code: dto.code.toUpperCase(),
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakMinutes: dto.breakMinutes ?? 60,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.shifts.set(shift.id, shift);
    return shift;
  }

  async updateShift(id: string, dto: UpdateShiftDto): Promise<Shift | null> {
    const existing = this.shifts.get(id);
    if (!existing) return null;

    const updated: Shift = {
      ...existing,
      name: dto.name ?? existing.name,
      code: dto.code ? dto.code.toUpperCase() : existing.code,
      startTime: dto.startTime ?? existing.startTime,
      endTime: dto.endTime ?? existing.endTime,
      breakMinutes: dto.breakMinutes !== undefined ? dto.breakMinutes : existing.breakMinutes,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      updatedAt: new Date().toISOString(),
    };
    this.shifts.set(id, updated);
    return updated;
  }

  async assignEmployeeShift(dto: AssignEmployeeShiftDto): Promise<EmployeeShift> {
    const now = new Date().toISOString();
    const assignment: EmployeeShift = {
      id: randomUUID(),
      employeeId: dto.employeeId,
      shiftId: dto.shiftId,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.employeeShifts.set(assignment.id, assignment);
    return assignment;
  }

  async findEmployeeShifts(employeeId: string): Promise<EmployeeShift[]> {
    return [...this.employeeShifts.values()]
      .filter((es) => es.employeeId === employeeId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }

  async getAttendancePolicy(): Promise<AttendancePolicy> {
    return this.policy;
  }

  async updateAttendancePolicy(dto: UpdateAttendancePolicyDto): Promise<AttendancePolicy> {
    this.policy = {
      ...this.policy,
      name: dto.name ?? this.policy.name,
      gracePeriodMinutes: dto.gracePeriodMinutes ?? this.policy.gracePeriodMinutes,
      halfDayThresholdMinutes: dto.halfDayThresholdMinutes ?? this.policy.halfDayThresholdMinutes,
      fullDayThresholdMinutes: dto.fullDayThresholdMinutes ?? this.policy.fullDayThresholdMinutes,
      timezone: dto.timezone ?? this.policy.timezone,
      isDefault: dto.isDefault ?? this.policy.isDefault,
      updatedAt: new Date().toISOString(),
    };
    return this.policy;
  }
}
