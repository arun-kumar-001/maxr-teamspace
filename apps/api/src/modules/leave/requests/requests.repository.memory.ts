import { randomUUID } from 'node:crypto';
import { conflict } from '../../../http/errors';
import { ScopeFilter, scopeAllows } from '../../rbac';
import type { LeaveTx } from '../policies/policies.types';
import { FindLeaveRequestsParams, ILeaveRequestsRepository } from './requests.repository';
import { LeaveRequest, LeaveRequestStatus, NewLeaveRequest } from './requests.types';

interface MemoryBalance {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allotted: number;
  carriedForward: number;
  used: number;
}

const LIVE: LeaveRequestStatus[] = ['applied', 'pending', 'approved'];

/** In-memory leave requests for unit and HTTP tests (not shipped in the build). */
export class MemoryLeaveRequestsRepository implements ILeaveRequestsRepository {
  requests: LeaveRequest[] = [];
  balances: MemoryBalance[] = [];
  names: Record<string, { code: string; name: string }> = {};

  constructor(private readonly managerOf: (employeeId: string) => string | null = () => null) {}

  /** Snapshot/restore stands in for a database rollback. */
  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ requests: this.requests, balances: this.balances });
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as LeaveTx);
    } catch (err) {
      this.requests = snapshot.requests;
      this.balances = snapshot.balances;
      throw err;
    }
  }

  private balance(employeeId: string, leaveTypeId: string, year: number) {
    return this.balances.find(
      (b) => b.employeeId === employeeId && b.leaveTypeId === leaveTypeId && b.year === year,
    );
  }

  async lockBalance(_tx: LeaveTx, employeeId: string, leaveTypeId: string, year: number) {
    const balance = this.balance(employeeId, leaveTypeId, year);
    if (!balance) return null;
    const reserved = this.requests
      .filter(
        (r) =>
          r.employeeId === employeeId &&
          r.leaveTypeId === leaveTypeId &&
          Number(r.startDate.slice(0, 4)) === year &&
          (r.status === 'applied' || r.status === 'pending'),
      )
      .reduce((sum, r) => sum + r.days, 0);
    return { available: balance.allotted + balance.carriedForward - balance.used - reserved };
  }

  async insert(_tx: LeaveTx, input: NewLeaveRequest): Promise<LeaveRequest> {
    if (
      this.requests.some(
        (r) =>
          r.employeeId === input.employeeId &&
          LIVE.includes(r.status) &&
          r.startDate <= input.endDate &&
          r.endDate >= input.startDate,
      )
    ) {
      throw conflict('These dates overlap another leave request of yours');
    }
    const now = new Date().toISOString();
    const type = this.names[input.leaveTypeId] ?? { code: 'ANNUAL', name: 'Annual leave' };
    const request: LeaveRequest = {
      id: randomUUID(),
      employeeId: input.employeeId,
      employeeName: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      leaveTypeCode: type.code,
      leaveTypeName: type.name,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay,
      days: input.days,
      reason: input.reason,
      status: 'applied',
      approvalId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.requests.push(request);
    return { ...request };
  }

  async findForUpdate(_tx: LeaveTx, id: string): Promise<LeaveRequest | null> {
    const found = this.requests.find((r) => r.id === id);
    return found ? { ...found } : null;
  }

  async setStatus(_tx: LeaveTx, id: string, status: LeaveRequestStatus): Promise<void> {
    const found = this.requests.find((r) => r.id === id);
    if (found) found.status = status;
  }

  async deduct(_tx: LeaveTx, employeeId: string, leaveTypeId: string, year: number, days: number) {
    const balance = this.balance(employeeId, leaveTypeId, year);
    if (!balance || balance.used + days > balance.allotted + balance.carriedForward) return null;
    const usedBefore = balance.used;
    balance.used += days;
    return { usedBefore, usedAfter: balance.used };
  }

  async find(id: string, filter: ScopeFilter): Promise<LeaveRequest | null> {
    const found = this.requests.find((r) => r.id === id);
    return found && scopeAllows(filter, found.employeeId, this.managerOf(found.employeeId))
      ? { ...found }
      : null;
  }

  async findMany(params: FindLeaveRequestsParams) {
    const matching = this.requests
      .filter(
        (r) =>
          scopeAllows(params.filter, r.employeeId, this.managerOf(r.employeeId)) &&
          (!params.employeeId || r.employeeId === params.employeeId) &&
          (!params.status || r.status === params.status) &&
          (!params.leaveTypeId || r.leaveTypeId === params.leaveTypeId) &&
          (!params.from || r.endDate >= params.from) &&
          (!params.to || r.startDate <= params.to),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    return {
      items: matching.slice(params.offset, params.offset + params.limit).map((r) => ({ ...r })),
      total: matching.length,
    };
  }
}
