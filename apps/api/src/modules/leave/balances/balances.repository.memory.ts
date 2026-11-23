import { ScopeFilter, scopeAllows } from '../../rbac';
import type { LeaveTx } from '../policies/policies.types';
import { FindBalancesParams, ILeaveBalancesRepository } from './balances.repository';
import { EmployeeLeaveBalance, LeaveBalance } from './balances.types';

/** In-memory balances for unit and HTTP tests (not shipped in the build). The accrual rules are tested against PostgreSQL. */
export class MemoryLeaveBalancesRepository implements ILeaveBalancesRepository {
  rows: EmployeeLeaveBalance[] = [];
  accruals: Array<{ year: number; employeeId?: string }> = [];
  createdPerAccrual = 0;

  constructor(private readonly managerOf: (employeeId: string) => string | null = () => null) {}

  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    return work({ query: async () => ({ rows: [] }) } as unknown as LeaveTx);
  }

  async accrue(_tx: LeaveTx, year: number, employeeId?: string): Promise<number> {
    this.accruals.push({ year, employeeId });
    return this.createdPerAccrual;
  }

  async findForEmployee(employeeId: string, year: number): Promise<LeaveBalance[]> {
    return this.rows.filter((r) => r.employeeId === employeeId && r.year === year);
  }

  async findMany(params: FindBalancesParams) {
    const matching = this.rows.filter(
      (r) =>
        r.year === params.year &&
        (!params.employeeId || r.employeeId === params.employeeId) &&
        scopeAllows(params.filter as ScopeFilter, r.employeeId, this.managerOf(r.employeeId)),
    );
    return {
      items: matching.slice(params.offset, params.offset + params.limit),
      total: matching.length,
    };
  }
}
