import { describe, expect, it } from 'vitest';
import { InMemoryAttendanceRepository } from './attendance.repository.memory';
import { AttendanceService } from './attendance.service';
import { CompanySettingsReader } from '../settings';

describe('AttendanceService (Company Timezone & Service Rules)', () => {
  it('computes workDate strictly according to company timezone from CompanySettingsReader', async () => {
    const repo = new InMemoryAttendanceRepository();

    // 1. Fake settings reader with Asia/Tokyo (+09:00)
    const tokyoReader: CompanySettingsReader = {
      getBasic: async () => ({
        companyName: 'MAXR Tokyo',
        timezone: 'Asia/Tokyo',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }),
    };

    const service = new AttendanceService(repo, undefined, tokyoReader);

    // Mock fixed time: 2026-10-31 20:00:00 UTC
    // In Tokyo (+09:00), this is 2026-11-01 05:00:00!
    const testDate = new Date('2026-10-31T20:00:00.000Z');
    const tokyoExpectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(
      testDate,
    );
    expect(tokyoExpectedDate).toBe('2026-11-01');

    // 2. Perform checkIn using current time
    const record = await service.checkIn(
      'emp-001',
      { notes: 'Tokyo shift' },
      { actorId: 'usr-001', actorRole: 'staff' },
    );

    const nowTokyo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(
      new Date(),
    );
    expect(record.workDate).toBe(nowTokyo);
    expect(record.status).toBe('PRESENT');
  });

  it('queries today summary using company timezone', async () => {
    const repo = new InMemoryAttendanceRepository();
    const kolkataReader: CompanySettingsReader = {
      getBasic: async () => ({
        companyName: 'MAXR India',
        timezone: 'Asia/Kolkata',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }),
    };

    const service = new AttendanceService(repo, undefined, kolkataReader);
    const summary = await service.getTodaySummary('emp-002');

    const expectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
      new Date(),
    );
    expect(summary.workDate).toBe(expectedDate);
    expect(summary.sessionsCount).toBe(0);
  });
});
