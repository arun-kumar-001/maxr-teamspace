import type { Job } from '../../platform/jobs/job-runner';
import type { LeaveBalancesService } from './balances/balances.service';

/** Creates the missing leave balances of the current year (D-12), so 1 January needs no human. */
export function createLeaveJobs(balances: LeaveBalancesService): Job[] {
  return [{ name: 'leave-accrual', run: async () => void (await balances.runScheduledAccrual()) }];
}
