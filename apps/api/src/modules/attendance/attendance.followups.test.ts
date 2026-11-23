import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import type { CompanySettingsReader } from '../settings';
import type { ShiftResolver, ShiftSummary } from '../shifts';
import { InMemoryAttendanceRepository } from './attendance.repository.memory';
import { AttendanceService, checkInStatus } from './attendance.service';

const day: ShiftSummary = {
  id: 's-day',
  code: 'GENERAL',
  name: 'General',
  startTime: '09:00',
  endTime: '18:00',
  graceMinutes: 15,
  crossesMidnight: false,
};
const night: ShiftSummary = {
  id: 's-night',
  code: 'NIGHT',
  name: 'Night',
  startTime: '22:00',
  endTime: '06:00',
  graceMinutes: 10,
  crossesMidnight: true,
};

describe('checkInStatus (D-13: late after the start plus the grace, on the company clock)', () => {
  const at = (iso: string, shift: ShiftSummary, tz: string) =>
    checkInStatus(shift, new Date(iso), tz);

  it.each([
    ['well before the start', '2026-10-30T02:30:00Z', 'present'], // 08:00 IST
    ['exactly at the start', '2026-10-30T03:30:00Z', 'present'], // 09:00
    ['on the last minute of grace', '2026-10-30T03:45:00Z', 'present'], // 09:15
    ['one minute past the grace', '2026-10-30T03:46:00Z', 'late'], // 09:16
    ['much later', '2026-10-30T08:30:00Z', 'late'], // 14:00
  ])('Asia/Kolkata, day shift 09:00 + 15: %s is %s', (_name, instant, expected) => {
    expect(at(instant, day, 'Asia/Kolkata')).toBe(expected);
  });

  it('judges the same instant on the company clock, not UTC', () => {
    // 04:00 UTC is 09:30 in Kolkata (late) and 04:00 in UTC (before the start).
    expect(at('2026-10-30T04:00:00Z', day, 'Asia/Kolkata')).toBe('late');
    expect(at('2026-10-30T04:00:00Z', day, 'UTC')).toBe('present');
  });

  it.each([
    ['22:10 is within the grace', '2026-10-30T16:40:00Z', 'present'], // 22:10 IST
    ['22:11 is late', '2026-10-30T16:41:00Z', 'late'],
    ['23:00 is late', '2026-10-30T17:30:00Z', 'late'],
    ['00:30 next morning is the tail of the shift, not late', '2026-10-30T19:00:00Z', 'present'],
    ['05:59 is still the tail', '2026-10-30T00:29:00Z', 'present'], // 05:59 IST
    ['10:00 (between end and start) is not late', '2026-10-30T04:30:00Z', 'present'],
  ])('a shift that runs past midnight, 22:00 + 10: %s', (_name, instant, expected) => {
    expect(at(instant, night, 'Asia/Kolkata')).toBe(expected);
  });

  it('a grace that runs past midnight never makes the same evening late', () => {
    const late: ShiftSummary = { ...night, startTime: '23:50', endTime: '02:00', graceMinutes: 30 };
    expect(at('2026-10-30T18:29:00Z', late, 'Asia/Kolkata')).toBe('present'); // 23:59 IST
  });
});

function build(shift: ShiftSummary | null, timezone = 'Asia/Kolkata') {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new InMemoryAttendanceRepository();
  const asked: Array<[string, string]> = [];
  const resolver: ShiftResolver | undefined = shift
    ? {
        shiftOn: async (employeeId, date) => {
          asked.push([employeeId, date]);
          return shift;
        },
      }
    : undefined;
  const settings: CompanySettingsReader = {
    getBasic: async () =>
      ({
        companyName: 'T',
        timezone,
        workWeek: { start: 'Monday', end: 'Friday', days: [] },
      }) as never,
  };
  const service = new AttendanceService(repo, platform.audit, settings, () => true, resolver);
  return { service, repo, auditStore, asked };
}

const ctx = { actorId: 'u-1', actorRole: 'staff' };

describe('AttendanceService.checkIn: status from the shift', () => {
  afterEach(() => vi.useRealTimers());

  it('records late after the grace, present within it, and asks for the shift of the company date', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T04:00:00Z') }); // 09:30 IST
    const late = build(day);
    const record = await late.service.checkIn('e-1', {}, ctx);
    expect(record).toMatchObject({ status: 'late', workDate: '2026-10-30' });
    expect(late.asked).toEqual([['e-1', '2026-10-30']]);

    vi.setSystemTime(new Date('2026-10-30T03:40:00Z')); // 09:10 IST
    expect((await build(day).service.checkIn('e-2', {}, ctx)).status).toBe('present');
  });

  it('uses the company date for the shift lookup around midnight', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T19:00:00Z') }); // 00:30 on the 31st in Kolkata
    const b = build(night);
    await b.service.checkIn('e-1', {}, ctx);
    expect(b.asked).toEqual([['e-1', '2026-10-31']]);
  });

  it('records present when no resolver is wired', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T12:00:00Z') });
    expect((await build(null).service.checkIn('e-1', {}, ctx)).status).toBe('present');
  });
});

describe('AttendanceService.checkIn: the audit entry', () => {
  it('never holds the coordinates or the address', async () => {
    const b = build(day);
    await b.service.checkIn(
      'e-1',
      {
        location: {
          latitude: 12.9716,
          longitude: 77.5946,
          address: '12 Residency Road',
          workMode: 'remote',
        },
      },
      ctx,
    );
    const [entry] = b.auditStore.find((e) => e.action === 'attendance.check_in');
    expect(entry?.metadata).toMatchObject({ locationProvided: true, workMode: 'remote' });
    const text = JSON.stringify(entry);
    expect(text).not.toContain('12.9716');
    expect(text).not.toContain('77.5946');
    expect(text).not.toContain('Residency');
  });

  it('says no location was given, and records the status', async () => {
    const b = build(day);
    await b.service.checkIn('e-1', {}, ctx);
    expect(b.auditStore.find((e) => e.action === 'attendance.check_in')[0]?.metadata).toMatchObject(
      {
        locationProvided: false,
        status: expect.stringMatching(/present|late/),
      },
    );
  });

  it('keeps the coordinates on the attendance record itself', async () => {
    const b = build(day);
    const record = await b.service.checkIn(
      'e-1',
      { location: { latitude: 1.5, longitude: 2.5 } },
      ctx,
    );
    expect(record.location).toMatchObject({ latitude: 1.5, longitude: 2.5 });
  });
});

describe('AttendanceService.checkOut', () => {
  it('answers a check-out that lost a race exactly like one with nothing open', async () => {
    const b = build(day);
    await b.service.checkIn('e-1', {}, ctx);
    // The session is closed by another request between the read and the write.
    b.repo.createCheckOut = async () => null;
    await expect(b.service.checkOut('e-1', {}, ctx)).rejects.toMatchObject({ statusCode: 400 });
    const nothing = build(day);
    await expect(nothing.service.checkOut('e-1', {}, ctx)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('a session that runs past midnight', () => {
  afterEach(() => vi.useRealTimers());

  it('belongs to the date it started and is not counted on the next day', async () => {
    const b = build(night);
    vi.useFakeTimers({ now: new Date('2026-10-30T18:20:00Z') }); // 23:50 on the 30th in Kolkata
    const record = await b.service.checkIn('e-1', {}, ctx);
    expect(record.workDate).toBe('2026-10-30');

    vi.setSystemTime(new Date('2026-10-30T18:50:00Z')); // 00:20 on the 31st
    const closed = await b.service.checkOut('e-1', {}, ctx);
    expect(closed).toMatchObject({ workDate: '2026-10-30', durationMinutes: 30 });
    expect(closed.checkOutTime).toBe('2026-10-30T18:50:00.000Z');

    const thirtyFirst = await b.service.getTodaySummary('e-1');
    expect(thirtyFirst).toMatchObject({
      workDate: '2026-10-31',
      sessionsCount: 0,
      totalDurationMinutes: 0,
    });
    vi.setSystemTime(new Date('2026-10-30T18:55:00Z'));
    // Still on the 31st for the company: yesterday's session is not today's.
    expect((await b.service.getTodaySummary('e-1')).sessionsCount).toBe(0);
  });

  it('an open session across midnight keeps blocking a second check-in', async () => {
    const b = build(night);
    vi.useFakeTimers({ now: new Date('2026-10-30T18:20:00Z') });
    await b.service.checkIn('e-1', {}, ctx);
    vi.setSystemTime(new Date('2026-10-30T19:30:00Z')); // 01:00 next day
    await expect(b.service.checkIn('e-1', {}, ctx)).rejects.toMatchObject({ statusCode: 409 });
  });
});
