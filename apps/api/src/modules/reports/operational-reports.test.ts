import { describe, expect, it } from 'vitest';
import { registerAttendanceReports } from '../attendance/reports/attendance-reports';
import { registerLeaveReports } from '../leave/reports/leave-reports';
import { registerTaskReports } from '../tasks/reports/task-reports';
import { REPORT_NAME } from './report-definition';
import { assertRange, companyDate, workDayNumbers } from './report-filters';
import { ReportRegistry } from './index';

const deps = {
  getPool: () => {
    throw new Error('no database in this test');
  },
  settings: { getBasic: async () => ({}) as never },
};

function registry() {
  const r = new ReportRegistry();
  registerAttendanceReports(r, deps);
  registerLeaveReports(r, deps);
  registerTaskReports(r, deps);
  return r;
}

describe('attendance, leave and task report definitions', () => {
  it('register under unique, valid names with the data permission of their module', () => {
    const definitions = registry().all();
    expect(definitions.map((d) => [d.name, d.module, d.dataPermissions])).toEqual([
      ['attendance-summary', 'attendance', ['attendance.list']],
      ['leave-usage', 'leave', ['leave_balances.list']],
      ['project-status', 'projects', ['projects.read']],
      ['task-status', 'tasks', ['tasks.read_team']],
    ]);
    for (const definition of definitions) {
      expect(definition.name).toMatch(REPORT_NAME);
      expect(definition.columns.length).toBeGreaterThan(0);
    }
  });

  it('never declare a sensitive column or one that carries free text', () => {
    const keys = registry()
      .all()
      .flatMap((d) => d.columns.map((c) => c.key.toLowerCase()));
    expect(
      keys.filter((k) =>
        /bank|salary|compensation|pay|document|passport|tax|reason|comment|title|description|notes|location/.test(
          k,
        ),
      ),
    ).toEqual([]);
  });

  it('reject an unknown filter on every report', () => {
    for (const definition of registry().all()) {
      const empty = definition.filters.safeParse({ unknownFilter: 'x' });
      expect(empty.success, definition.name).toBe(false);
    }
  });
});

describe('report filter helpers', () => {
  it('turns the company working days into PostgreSQL day numbers (Sunday is 0)', () => {
    expect(workDayNumbers(['Monday', 'Friday', 'Sunday'])).toEqual([1, 5, 0]);
    expect(workDayNumbers(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'])).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it('gives the company calendar date of an instant', () => {
    const instant = new Date('2026-12-31T20:00:00Z');
    expect(companyDate(instant, 'UTC')).toBe('2026-12-31');
    expect(companyDate(instant, 'Asia/Kolkata')).toBe('2027-01-01');
    expect(companyDate(instant, 'America/Los_Angeles')).toBe('2026-12-31');
  });

  it('accepts a range shorter than the maximum and refuses a reversed or too long one', () => {
    expect(() => assertRange('2026-01-01', '2026-01-01', 92)).not.toThrow();
    expect(() => assertRange('2026-01-01', '2026-04-02', 92)).not.toThrow(); // 91 days apart
    expect(() => assertRange('2026-01-01', '2026-04-03', 92)).toThrow(); // 92 days apart
    expect(() => assertRange('2026-02-01', '2026-01-01', 92)).toThrow();
  });
});
