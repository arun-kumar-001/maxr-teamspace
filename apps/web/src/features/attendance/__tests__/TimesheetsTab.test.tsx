// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { TimesheetsTab } from '../components/TimesheetsTab';
import type { AttendanceRecord } from '../types';

const employee = (id: string, firstName: string, code: string): EmployeeDirectoryItem =>
  ({
    id,
    firstName,
    lastName: 'Tester',
    employeeCode: code,
    department: { id: 'd1', name: 'Engineering' },
  }) as unknown as EmployeeDirectoryItem;

const record = (
  id: string,
  employeeId: string,
  workDate: string,
  minutes: number,
  extra: Partial<AttendanceRecord> = {},
): AttendanceRecord =>
  ({
    id,
    employeeId,
    employeeName: 'x',
    workDate,
    checkInTime: `${workDate}T09:00:00Z`,
    checkOutTime: `${workDate}T17:00:00Z`,
    durationMinutes: minutes,
    breakMinutes: 0,
    status: 'present',
    ...extra,
  }) as unknown as AttendanceRecord;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// The week of Monday 2 to Sunday 8 November 2026, long over, so all five working days count.
describe('TimesheetsTab', () => {
  const originalFetch = globalThis.fetch;
  // What the attendance endpoint answers; the tab asks the server for the week.
  let serverRecords: AttendanceRecord[] = [];

  beforeEach(() => {
    serverRecords = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/attendance/policies')) {
        return json({
          data: {
            fullDayMinutes: 480,
            halfDayMinutes: 240,
            defaultShiftId: 's1',
            timezone: 'Asia/Kolkata',
            workWeek: {
              start: 'Monday',
              end: 'Friday',
              days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            },
          },
        });
      }
      if (url.includes('/holidays')) {
        return json({ data: [{ id: 'h1', date: '2026-11-04', name: 'Midweek holiday' }] });
      }
      if (url.includes('/leave-requests/calendar')) {
        return json({
          data: [
            {
              requestId: 'l1',
              employeeId: 'e2',
              employeeName: 'Bea',
              leaveTypeCode: 'AL',
              leaveTypeName: 'Annual',
              startDate: '2026-11-05',
              endDate: '2026-11-05',
              halfDay: false,
              days: 1,
              status: 'approved',
            },
          ],
        });
      }
      if (url.includes('/api/v1/attendance')) {
        // Like the server: only the records inside the requested dates.
        const query = new URL(url, 'http://localhost').searchParams;
        const from = query.get('startDate') ?? '0000-00-00';
        const to = query.get('endDate') ?? '9999-99-99';
        const inRange = serverRecords.filter((r) => r.workDate >= from && r.workDate <= to);
        return json({ data: inRange, meta: { page: 1, pageSize: 300, total: inRange.length } });
      }
      return json({ data: [] });
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const renderTab = (records: AttendanceRecord[]) => {
    serverRecords = records;
    return render(
      <TimesheetsTab
        records={records}
        employees={[employee('e1', 'Ann', 'E-001'), employee('e2', 'Bea', 'E-002')]}
        departments={[]}
        canViewTeam={true}
        selectedDate="2026-11-03"
      />,
    );
  };

  const rowOf = (name: string) =>
    screen.getByRole('button', { name: `Timesheet details for ${name} Tester` }).closest('tr')!;

  it('plans from the company week, holidays and approved leave, and shows the difference', async () => {
    renderTab([
      record('r1', 'e1', '2026-11-02', 480),
      record('r2', 'e1', '2026-11-03', 480),
      record('r3', 'e1', '2026-11-05', 480),
      record('r4', 'e1', '2026-11-06', 480),
      record('r5', 'e1', '2026-11-09', 120),
    ]);

    // Ann: 5 working days less the holiday = 4 days, 32 h planned. She worked 4 days, 32 h.
    // Planned and worked are both 32h.
    await waitFor(() => expect(within(rowOf('Ann')).getAllByText('32h')).toHaveLength(2));
    expect(within(rowOf('Ann')).getByText(/On plan/)).toBeInTheDocument();
    // Bea: less the holiday and her approved leave day = 3 days, 24 h planned, none worked.
    expect(within(rowOf('Bea')).getByText('24h')).toBeInTheDocument();
    expect(within(rowOf('Bea')).getByText(/-24h short/)).toBeInTheDocument();
  });

  it('shows overtime as plus and says it in words', async () => {
    renderTab([
      record('r1', 'e1', '2026-11-02', 600),
      record('r2', 'e1', '2026-11-03', 600),
      record('r3', 'e1', '2026-11-05', 600),
      record('r4', 'e1', '2026-11-06', 600),
    ]);
    await waitFor(() => expect(within(rowOf('Ann')).getByText(/\+8h over/)).toBeInTheDocument());
  });

  it('flags a past check-in with no check-out in the row, not in a status column', async () => {
    renderTab([record('r1', 'e1', '2026-11-02', 0, { checkOutTime: null })]);
    expect(await screen.findByText(/Missing check-out on 2026-11-02/)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
  });

  it('opens the week in detail from the person, with no approval anywhere', async () => {
    renderTab([record('r1', 'e1', '2026-11-02', 480)]);
    fireEvent.click(screen.getByRole('button', { name: 'Timesheet details for Ann Tester' }));

    expect(await screen.findByText(/Daily Breakdown/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull();
  });

  it('shows dashes instead of inventing a plan when the company plan cannot be read', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{}', { status: 403 }),
    ) as unknown as typeof fetch;
    renderTab([record('r1', 'e1', '2026-11-02', 480)]);

    await waitFor(() => expect(within(rowOf('Ann')).getByText('8h')).toBeInTheDocument());
    expect(within(rowOf('Ann')).queryByText('40h')).toBeNull();
    expect(within(rowOf('Ann')).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
