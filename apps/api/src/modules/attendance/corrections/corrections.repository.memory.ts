import { randomUUID } from 'node:crypto';
import { conflict } from '../../../http/errors';
import { ScopeFilter, scopeAllows } from '../../rbac';
import { FindCorrectionsParams, ICorrectionsRepository } from './corrections.repository';
import {
  AttendanceCorrection,
  CorrectableRecord,
  CorrectionStatus,
  CorrectionTx,
  NewCorrection,
  RecordTimes,
} from './corrections.types';

/** In-memory corrections for unit and HTTP tests (not shipped in the build). */
export class MemoryCorrectionsRepository implements ICorrectionsRepository {
  records: CorrectableRecord[] = [];
  corrections: AttendanceCorrection[] = [];

  constructor(
    /** Stands in for `employees.manager_id`, which the team scope reads. */
    private readonly managerOf: (employeeId: string) => string | null = () => null,
  ) {}

  /** Snapshot/restore stands in for a database rollback. */
  async transaction<T>(work: (tx: CorrectionTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ records: this.records, corrections: this.corrections });
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as CorrectionTx);
    } catch (err) {
      this.records = snapshot.records;
      this.corrections = snapshot.corrections;
      throw err;
    }
  }

  async lockRecord(_tx: CorrectionTx, recordId: string): Promise<CorrectableRecord | null> {
    return this.records.find((r) => r.id === recordId) ?? null;
  }

  async hasOverlap(
    _tx: CorrectionTx,
    employeeId: string,
    excludeRecordId: string,
    from: string,
    to: string,
  ): Promise<boolean> {
    return this.records.some(
      (r) =>
        r.employeeId === employeeId &&
        r.id !== excludeRecordId &&
        Date.parse(r.checkIn) < Date.parse(to) &&
        (r.checkOut === null || Date.parse(r.checkOut) > Date.parse(from)),
    );
  }

  async insert(_tx: CorrectionTx, input: NewCorrection): Promise<AttendanceCorrection> {
    if (
      this.corrections.some(
        (c) => c.attendanceRecordId === input.attendanceRecordId && c.status === 'pending',
      )
    ) {
      throw conflict('This attendance record already has a pending correction');
    }
    const record = this.records.find((r) => r.id === input.attendanceRecordId);
    const now = new Date().toISOString();
    const correction: AttendanceCorrection = {
      id: randomUUID(),
      ...input,
      workDate: record?.workDate ?? '',
      status: 'pending',
      approvalId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.corrections.push(correction);
    return { ...correction };
  }

  async findForUpdate(_tx: CorrectionTx, id: string): Promise<AttendanceCorrection | null> {
    const found = this.corrections.find((c) => c.id === id);
    return found ? { ...found } : null;
  }

  async find(id: string, filter: ScopeFilter): Promise<AttendanceCorrection | null> {
    const found = this.corrections.find((c) => c.id === id);
    return found && scopeAllows(filter, found.employeeId, this.managerOf(found.employeeId))
      ? { ...found }
      : null;
  }

  async setStatus(_tx: CorrectionTx, id: string, status: CorrectionStatus): Promise<void> {
    const found = this.corrections.find((c) => c.id === id);
    if (found) found.status = status;
  }

  async writeRecordTimes(_tx: CorrectionTx, recordId: string, times: RecordTimes): Promise<void> {
    const record = this.records.find((r) => r.id === recordId);
    if (!record) return;
    record.checkIn = times.checkIn;
    record.checkOut = times.checkOut;
    record.durationMinutes = times.durationMinutes;
    record.status = times.status;
  }

  async findMany(params: FindCorrectionsParams) {
    const matching = this.corrections
      .filter(
        (c) =>
          scopeAllows(params.filter, c.employeeId, this.managerOf(c.employeeId)) &&
          (!params.status || c.status === params.status),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: matching.slice(params.offset, params.offset + params.limit).map((c) => ({ ...c })),
      total: matching.length,
    };
  }
}
