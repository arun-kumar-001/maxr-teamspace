import { PaginatedResponse } from '@maxr/shared';
import { unprocessable } from '../../../http/errors';
import { buildPage, toOffsetLimit } from '../../../http/pagination';
import type { PlatformServices } from '../../../platform';
import { ScopeFilter } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';
import type { LeaveTx } from '../policies/policies.types';
import { ILeaveBalancesRepository } from './balances.repository';
import type { ListBalancesQuery } from './balances.schemas';
import { EmployeeLeaveBalance, LeaveBalance } from './balances.types';

type Deps = Pick<PlatformServices, 'audit'>;

export interface BalanceCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

export class LeaveBalancesService {
  constructor(
    private readonly repository: ILeaveBalancesRepository,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** The current year on the company clock. */
  private async currentYear(): Promise<number> {
    const { timezone } = await this.settings.getBasic();
    return Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(this.clock()).slice(0, 4),
    );
  }

  async mine(employeeId: string, year: number | undefined): Promise<LeaveBalance[]> {
    return this.repository.findForEmployee(employeeId, year ?? (await this.currentYear()));
  }

  async list(
    query: ListBalancesQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<EmployeeLeaveBalance>> {
    const { items, total } = await this.repository.findMany({
      filter,
      employeeId: query.employeeId,
      year: query.year ?? (await this.currentYear()),
      ...toOffsetLimit(query),
    });
    return buildPage(items, total, query);
  }

  /**
   * Creates the missing balances of a year for everyone (HR runs it on 1 January, and after adding
   * a leave type). Safe to repeat. A year that has not started cannot be accrued: the carry-forward
   * would be taken from a year that is still changing.
   */
  async accrue(year: number, caller: BalanceCaller): Promise<{ year: number; created: number }> {
    const current = await this.currentYear();
    if (year > current) throw unprocessable('Balances can only be created up to the current year');
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const created = await this.repository.accrue(tx, year);
      await audit.record(
        {
          action: 'leave_balances.accrue',
          outcome: 'success',
          entityType: 'leave_balance',
          changes: { year, created },
        },
        { transaction: tx },
      );
      return { year, created };
    });
  }

  /**
   * Gives a new employee their balances inside the transaction that creates them. The year is the
   * joining year, or the current one when they joined earlier; the pro-rata is in the SQL.
   */
  async initializeForJoiner(tx: LeaveTx, employeeId: string, joiningDate: string): Promise<void> {
    const joiningYear = Number(joiningDate.slice(0, 4));
    await this.repository.accrue(tx, Math.max(joiningYear, await this.currentYear()), employeeId);
  }
}
