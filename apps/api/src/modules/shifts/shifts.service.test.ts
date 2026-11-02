import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { AuditError } from '../../platform/audit/types';
import type { CompanySettingsReader } from '../settings';
import { MemoryShiftsRepository } from './shifts.repository.memory';
import { ShiftsService } from './shifts.service';

const caller = { actorId: 'u-actor', employeeId: 'e-actor', requestId: 'req-1' };
const GENERAL = '70000000-0000-4000-8000-000000000001';

function build(timezone = 'UTC') {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryShiftsRepository([
    { id: 'e-1', status: 'active', managerId: null },
    { id: 'e-2', status: 'pending', managerId: null },
    { id: 'e-gone', status: 'deactivated', managerId: null },
  ]);
  const zone = { value: timezone };
  const settings: CompanySettingsReader = {
    getBasic: async () =>
      ({
        companyName: 'Test',
        timezone: zone.value,
        workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
      }) as never,
  };
  const service = new ShiftsService(repo, platform, settings);
  const events: unknown[] = [];
  platform.events.subscribe('shift.assigned', (e) => {
    events.push(e.payload);
  });
  return { service, repo, auditStore, events, zone };
}

const night = {
  code: 'NIGHT',
  name: 'Night',
  startTime: '22:00',
  endTime: '06:00',
  graceMinutes: 10,
};

describe('shifts', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });
  afterEach(() => vi.useRealTimers());

  describe('createShift', () => {
    it('creates a shift that runs past midnight, flags it, and audits it', async () => {
      const shift = await ctx.service.createShift(night, caller);
      expect(shift).toMatchObject({ code: 'NIGHT', crossesMidnight: true, isActive: true });
      expect(ctx.auditStore.find((e) => e.action === 'shift.create')).toMatchObject([
        {
          outcome: 'success',
          entityId: shift.id,
          changes: { code: 'NIGHT', crossesMidnight: true },
        },
      ]);
    });

    it('a day shift does not cross midnight', async () => {
      const s = await ctx.service.createShift(
        { code: 'EARLY', name: 'Early', startTime: '06:00', endTime: '14:00', graceMinutes: 5 },
        caller,
      );
      expect(s.crossesMidnight).toBe(false);
    });

    it('refuses a code that is taken, whatever the letter case', async () => {
      await expect(
        ctx.service.createShift({ ...night, code: 'general' }, caller),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('a failure while writing leaves no shift and audits the failure', async () => {
      ctx.repo.failAfterWrite = new Error('write failed');
      await expect(ctx.service.createShift(night, caller)).rejects.toThrow('write failed');
      expect(ctx.repo.shifts).toHaveLength(1);
      expect(ctx.auditStore.find((e) => e.action === 'shift.create')).toMatchObject([
        { outcome: 'failure' },
      ]);
    });
  });

  describe('updateShift', () => {
    it('changes the fields and audits the old and new values', async () => {
      const s = await ctx.service.updateShift(GENERAL, { graceMinutes: 30, name: 'Day' }, caller);
      expect(s).toMatchObject({ graceMinutes: 30, name: 'Day' });
      expect(ctx.auditStore.find((e) => e.action === 'shift.update')[0]?.changes).toMatchObject({
        fields: ['graceMinutes', 'name'],
        graceMinutes: { from: 15, to: 30 },
      });
    });

    it('recomputes whether it crosses midnight', async () => {
      const s = await ctx.service.updateShift(GENERAL, { endTime: '07:00' }, caller);
      expect(s.crossesMidnight).toBe(true);
    });

    it('refuses the same start and end, using the stored time for the one not sent', async () => {
      await expect(
        ctx.service.updateShift(GENERAL, { endTime: '09:00' }, caller),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('writes nothing when no value differs', async () => {
      await ctx.service.updateShift(GENERAL, { graceMinutes: 15 }, caller);
      expect(ctx.auditStore.find((e) => e.action === 'shift.update')).toHaveLength(0);
    });

    it('answers 404 for an unknown shift', async () => {
      await expect(ctx.service.updateShift('nope', { name: 'x' }, caller)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('refuses to deactivate the policy default shift', async () => {
      await expect(
        ctx.service.updateShift(GENERAL, { isActive: false }, caller),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(ctx.repo.shifts[0]?.isActive).toBe(true);
    });

    it('refuses to deactivate a shift with an assignment in force, allows one that only ended', async () => {
      vi.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z') });
      const s = await ctx.service.createShift(night, caller);
      await ctx.service.assign(
        {
          employeeId: 'e-1',
          shiftId: s.id,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-06-14',
        },
        caller,
      );
      expect((await ctx.service.updateShift(s.id, { isActive: false }, caller)).isActive).toBe(
        false,
      );

      const t = await ctx.service.createShift({ ...night, code: 'LATE' }, caller);
      await ctx.service.assign(
        { employeeId: 'e-1', shiftId: t.id, effectiveFrom: '2026-06-15', effectiveTo: null },
        caller,
      );
      await expect(
        ctx.service.updateShift(t.id, { isActive: false }, caller),
      ).rejects.toMatchObject({
        statusCode: 422,
      });
    });

    it('counts "still in force" by the company calendar day, not UTC', async () => {
      // 19:00 UTC on 31 October is 00:30 on 1 November in Kolkata.
      vi.useFakeTimers({ now: new Date('2026-10-31T19:00:00Z') });
      const s = await ctx.service.createShift(night, caller);
      await ctx.service.assign(
        {
          employeeId: 'e-1',
          shiftId: s.id,
          effectiveFrom: '2026-10-01',
          effectiveTo: '2026-10-31',
        },
        caller,
      );
      await expect(
        ctx.service.updateShift(s.id, { isActive: false }, caller),
      ).rejects.toMatchObject({
        statusCode: 422,
      });
      ctx.zone.value = 'Asia/Kolkata';
      expect((await ctx.service.updateShift(s.id, { isActive: false }, caller)).isActive).toBe(
        false,
      );
    });
  });

  describe('assign', () => {
    const open = (from: string, to: string | null = null) => ({
      employeeId: 'e-1',
      shiftId: GENERAL,
      effectiveFrom: from,
      effectiveTo: to,
    });

    it('creates an assignment, audits it and announces it', async () => {
      const a = await ctx.service.assign(open('2026-03-01'), caller);
      expect(a).toMatchObject({
        employeeId: 'e-1',
        effectiveFrom: '2026-03-01',
        effectiveTo: null,
      });
      expect(a.shift.code).toBe('GENERAL');
      expect(ctx.auditStore.find((e) => e.action === 'shift.assign')).toMatchObject([
        {
          outcome: 'success',
          entityId: a.id,
          changes: { employeeId: 'e-1', effectiveFrom: '2026-03-01' },
        },
      ]);
      expect(ctx.events).toEqual([
        { employeeId: 'e-1', shiftId: GENERAL, effectiveFrom: '2026-03-01', effectiveTo: null },
      ]);
    });

    it('a new open-ended assignment ends the current one the day before', async () => {
      const night2 = await ctx.service.createShift(night, caller);
      await ctx.service.assign(open('2026-01-01'), caller);
      await ctx.service.assign(
        { employeeId: 'e-1', shiftId: night2.id, effectiveFrom: '2026-03-01', effectiveTo: null },
        caller,
      );
      const all = await ctx.service.listAssignments('e-1', { kind: 'all' }, caller);
      expect(all.map((a) => [a.shift.code, a.effectiveFrom, a.effectiveTo])).toEqual([
        ['NIGHT', '2026-03-01', null],
        ['GENERAL', '2026-01-01', '2026-02-28'],
      ]);
      expect(ctx.auditStore.find((e) => e.action === 'shift.assign')[1]?.changes).toMatchObject({
        endedPrevious: { effectiveTo: '2026-02-28' },
      });
    });

    it('handles the leap day when ending the previous assignment', async () => {
      await ctx.service.assign(open('2027-01-01'), caller);
      await ctx.service.assign(open('2028-03-01'), caller);
      const [, previous] = await ctx.service.listAssignments('e-1', { kind: 'all' }, caller);
      expect(previous?.effectiveTo).toBe('2028-02-29');
    });

    it('accepts an assignment that starts the day after the last one ended', async () => {
      await ctx.service.assign(open('2026-01-01', '2026-03-31'), caller);
      await ctx.service.assign(open('2026-04-01', '2026-06-30'), caller);
      expect(ctx.repo.assignments).toHaveLength(2);
    });

    it.each([
      [
        'inside a bounded assignment',
        open('2026-02-01', '2026-02-10'),
        open('2026-01-01', '2026-03-31'),
      ],
      ['overlapping its end', open('2026-03-15', '2026-04-15'), open('2026-01-01', '2026-03-31')],
      ['overlapping its start', open('2025-12-15', '2026-01-15'), open('2026-01-01', '2026-03-31')],
      ['starting on the same day as an open-ended one', open('2026-01-01'), open('2026-01-01')],
      ['before an open-ended one, with no end', open('2025-01-01'), open('2026-01-01')],
      ['bounded, inside an open-ended one', open('2026-02-01', '2026-02-10'), open('2026-01-01')],
    ])('refuses an assignment %s with 409 and changes nothing', async (_name, second, first) => {
      await ctx.service.assign(first, caller);
      const before = structuredClone(ctx.repo.assignments);
      const err = await ctx.service.assign(second, caller).catch((e) => e);
      expect(err.statusCode).toBe(409);
      expect(err.message).toContain('GENERAL');
      expect(ctx.repo.assignments).toEqual(before);
    });

    it('undoes ending the previous assignment when the new one cannot be stored', async () => {
      await ctx.service.assign(open('2026-01-01'), caller);
      ctx.repo.failAfterWrite = new Error('insert failed');
      await expect(ctx.service.assign(open('2026-03-01'), caller)).rejects.toThrow('insert failed');
      expect(ctx.repo.assignments).toHaveLength(1);
      expect(ctx.repo.assignments[0]?.effectiveTo).toBeNull();
      expect(ctx.events).toHaveLength(1);
    });

    it('turns a clash found only by the database constraint into a 409', async () => {
      const real = ctx.repo.findOverlapping.bind(ctx.repo);
      await ctx.service.assign(open('2026-01-01', '2026-01-31'), caller);
      // The pre-check sees nothing (another request is in flight); the constraint catches it.
      ctx.repo.findOverlapping = async () => [];
      await expect(
        ctx.service.assign(open('2026-01-15', '2026-02-15'), caller),
      ).rejects.toMatchObject({ statusCode: 409 });
      ctx.repo.findOverlapping = real;
    });

    it.each([
      ['a deactivated employee', { ...open('2026-03-01'), employeeId: 'e-gone' }, 422],
      ['an unknown employee', { ...open('2026-03-01'), employeeId: 'nobody' }, 404],
      ['an unknown shift', { ...open('2026-03-01'), shiftId: 'nope' }, 422],
    ])('refuses %s', async (_name, dto, status) => {
      await expect(ctx.service.assign(dto, caller)).rejects.toMatchObject({ statusCode: status });
      expect(ctx.repo.assignments).toHaveLength(0);
    });

    it('refuses an inactive shift but allows a pending employee (pre-assigned joiner)', async () => {
      const s = await ctx.service.createShift(night, caller);
      ctx.repo.shifts.find((x) => x.id === s.id)!.isActive = false;
      await expect(
        ctx.service.assign({ ...open('2026-03-01'), shiftId: s.id }, caller),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(
        (await ctx.service.assign({ ...open('2026-03-01'), employeeId: 'e-2' }, caller)).employeeId,
      ).toBe('e-2');
    });

    it('an audit failure undoes the assignment (fail closed)', async () => {
      ctx.auditStore.failNextWith(new AuditError('audit store down'));
      await expect(ctx.service.assign(open('2026-03-01'), caller)).rejects.toThrow();
      expect(ctx.repo.assignments).toHaveLength(0);
    });
  });

  describe('shiftOn', () => {
    it('uses the assignment on its first and last day, and the default outside it', async () => {
      const n = await ctx.service.createShift(night, caller);
      await ctx.service.assign(
        {
          employeeId: 'e-1',
          shiftId: n.id,
          effectiveFrom: '2026-03-01',
          effectiveTo: '2026-03-31',
        },
        caller,
      );
      const code = async (d: string) => (await ctx.service.shiftOn('e-1', d)).code;
      expect(await code('2026-02-28')).toBe('GENERAL');
      expect(await code('2026-03-01')).toBe('NIGHT');
      expect(await code('2026-03-31')).toBe('NIGHT');
      expect(await code('2026-04-01')).toBe('GENERAL');
      expect((await ctx.service.shiftOn('e-2', '2026-03-15')).code).toBe('GENERAL');
    });
  });

  describe('policy', () => {
    it('shows the policy with the default shift and the company timezone and work week', async () => {
      ctx = build('Asia/Kolkata');
      const p = await ctx.service.getPolicy();
      expect(p).toMatchObject({
        fullDayMinutes: 480,
        halfDayMinutes: 240,
        timezone: 'Asia/Kolkata',
        defaultShift: { code: 'GENERAL', startTime: '09:00' },
      });
    });

    it('changes the policy and audits the old and new values', async () => {
      const p = await ctx.service.updatePolicy(
        { fullDayMinutes: 540, halfDayMinutes: 270 },
        caller,
      );
      expect(p).toMatchObject({ fullDayMinutes: 540, halfDayMinutes: 270 });
      expect(ctx.auditStore.find((e) => e.action === 'attendance_policy.update')).toMatchObject([
        {
          outcome: 'success',
          changes: {
            fields: ['fullDayMinutes', 'halfDayMinutes'],
            fullDayMinutes: { from: 480, to: 540 },
          },
        },
      ]);
    });

    it('can move the default to another active shift', async () => {
      const n = await ctx.service.createShift(night, caller);
      expect(
        (await ctx.service.updatePolicy({ defaultShiftId: n.id }, caller)).defaultShift.code,
      ).toBe('NIGHT');
    });

    it.each([
      ['a half day as long as a full day', { halfDayMinutes: 480 }],
      ['a half day longer than the full day just set', { fullDayMinutes: 200 }],
      ['an unknown default shift', { defaultShiftId: 'nope' }],
    ])('refuses %s with 422 and changes nothing', async (_name, patch) => {
      await expect(ctx.service.updatePolicy(patch, caller)).rejects.toMatchObject({
        statusCode: 422,
      });
      expect(ctx.repo.policy).toMatchObject({ fullDayMinutes: 480, halfDayMinutes: 240 });
    });

    it('refuses an inactive default shift', async () => {
      const n = await ctx.service.createShift(night, caller);
      ctx.repo.shifts.find((x) => x.id === n.id)!.isActive = false;
      await expect(
        ctx.service.updatePolicy({ defaultShiftId: n.id }, caller),
      ).rejects.toMatchObject({
        statusCode: 422,
      });
    });

    it('writes nothing when no value differs', async () => {
      await ctx.service.updatePolicy({ fullDayMinutes: 480 }, caller);
      expect(ctx.auditStore.find((e) => e.action === 'attendance_policy.update')).toHaveLength(0);
    });

    it('an audit failure undoes the change (fail closed)', async () => {
      ctx.auditStore.failNextWith(new AuditError('audit store down'));
      await expect(ctx.service.updatePolicy({ fullDayMinutes: 600 }, caller)).rejects.toThrow();
      expect(ctx.repo.policy.fullDayMinutes).toBe(480);
    });
  });
});
