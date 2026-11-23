import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { LeaveBalancesService } from './balances/balances.service';
import { MemoryLeaveBalancesRepository } from './balances/balances.repository.memory';
import { createLeaveJobs } from './leave.jobs';

function build(timezone = 'Asia/Kolkata', now = new Date('2026-12-31T20:00:00Z')) {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryLeaveBalancesRepository();
  const service = new LeaveBalancesService(
    repo,
    platform,
    {
      getBasic: async () =>
        ({
          companyName: 'T',
          timezone,
          workWeek: { start: 'Monday', end: 'Friday', days: [] },
        }) as never,
    },
    () => now,
  );
  return { service, repo, auditStore };
}

describe('the scheduled leave accrual (D-12)', () => {
  it('is named leave-accrual and runs the accrual', async () => {
    const { service, repo } = build();
    const jobs = createLeaveJobs(service);
    expect(jobs.map((job) => job.name)).toEqual(['leave-accrual']);
    repo.createdPerAccrual = 3;
    await jobs[0]?.run(new Date());
    expect(repo.accruals).toHaveLength(1);
  });

  it('accrues the current year on the company calendar, which can already be the next year', async () => {
    // 20:00 UTC on 31 December is 01:30 on 1 January in Kolkata.
    const kolkata = build('Asia/Kolkata');
    await kolkata.service.runScheduledAccrual();
    expect(kolkata.repo.accruals).toEqual([{ year: 2027, employeeId: undefined }]);
    const utc = build('UTC');
    await utc.service.runScheduledAccrual();
    expect(utc.repo.accruals).toEqual([{ year: 2026, employeeId: undefined }]);
  });

  it('writes an audit entry only when it created balances, and says it was scheduled', async () => {
    const { service, repo, auditStore } = build();
    repo.createdPerAccrual = 0;
    expect(await service.runScheduledAccrual()).toBe(0);
    expect(auditStore.find((e) => e.action === 'leave_balances.accrue')).toHaveLength(0);
    repo.createdPerAccrual = 12;
    expect(await service.runScheduledAccrual()).toBe(12);
    const entries = auditStore.find((e) => e.action === 'leave_balances.accrue');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      changes: { year: 2027, created: 12 },
      metadata: { scheduled: true },
    });
    expect(entries[0]?.actorId).toBeUndefined();
  });
});
