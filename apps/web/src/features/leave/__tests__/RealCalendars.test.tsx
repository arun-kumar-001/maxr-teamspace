// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HolidayCalendar } from '../components/HolidayCalendar';
import { LeaveCalendarView } from '../components/LeaveCalendarView';
import type { LeaveCalendarEntry } from '../types';

afterEach(cleanup);

const FAKE_NAMES = /Christmas|Pongal|Republic Day|Alex Mercer|Daniel Johnson|December,? 2023/;

describe('HolidayCalendar shows only the holidays the company added', () => {
  it('says so, with no sample holidays, when there are none', () => {
    render(<HolidayCalendar holidays={[]} year={2027} onYearChange={vi.fn()} />);

    expect(screen.getByTestId('holiday-empty')).toHaveTextContent('No holidays added yet');
    expect(document.body).not.toHaveTextContent(FAKE_NAMES);
  });

  it('marks the added day in the month grid and lists it', () => {
    render(
      <HolidayCalendar
        holidays={[{ id: 'h1', date: '2027-03-09', name: 'Founders Day' }]}
        year={2027}
        onYearChange={vi.fn()}
      />,
    );
    // The year is not the current one, so the grid opens on January: go to March.
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('heading', { name: 'March 2027' })).toBeInTheDocument();
    expect(screen.getByTestId('holiday-day-2027-03-09')).toHaveAccessibleName('9: Founders Day');
    expect(screen.getByText('Founders Day')).toBeInTheDocument();
  });

  it('moves to the next year when paging past December', () => {
    const onYearChange = vi.fn();
    render(<HolidayCalendar holidays={[]} year={2027} onYearChange={onYearChange} />);
    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    }
    expect(onYearChange).toHaveBeenCalledWith(2028);
  });

  it('moves to the year before when paging back past January', () => {
    const onYearChange = vi.fn();
    render(<HolidayCalendar holidays={[]} year={2027} onYearChange={onYearChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onYearChange).toHaveBeenCalledWith(2026);
  });

  it('offers adding the first holiday only to someone who can manage them', () => {
    const onAdd = vi.fn();
    const { rerender } = render(
      <HolidayCalendar holidays={[]} year={2027} onYearChange={vi.fn()} onAddHoliday={onAdd} />,
    );
    expect(screen.queryByRole('button', { name: 'Add Holiday' })).not.toBeInTheDocument();

    rerender(
      <HolidayCalendar
        holidays={[]}
        year={2027}
        onYearChange={vi.fn()}
        onAddHoliday={onAdd}
        canManage
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Holiday' }));
    expect(onAdd).toHaveBeenCalled();
  });
});

const entry = (over: Partial<LeaveCalendarEntry>): LeaveCalendarEntry => ({
  requestId: 'r1',
  employeeId: 'e1',
  employeeName: 'Priya Raman',
  leaveTypeCode: 'SICK',
  leaveTypeName: 'Sick Leave',
  startDate: '2026-11-10',
  endDate: '2026-11-11',
  halfDay: false,
  days: 2,
  status: 'approved',
  ...over,
});

describe('LeaveCalendarView shows real leave for the month it is on', () => {
  it('has no sample people or numbers when nobody is on leave', () => {
    render(<LeaveCalendarView entries={[]} />);

    expect(screen.getByTestId('leave-calendar-empty')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(FAKE_NAMES);
    expect(document.body).not.toHaveTextContent(/days left/);
  });

  it('asks the page for the first and last day of the month, and again when the month changes', () => {
    const onRangeChange = vi.fn();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 23));
    render(<LeaveCalendarView entries={[]} onRangeChange={onRangeChange} />);

    expect(onRangeChange).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onRangeChange).toHaveBeenLastCalledWith('2026-12-01', '2026-12-31');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onRangeChange).toHaveBeenLastCalledWith('2027-01-01', '2027-01-31');
    vi.useRealTimers();
  });

  it('puts a leave on each day it covers and labels a pending request as pending', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 23));
    render(
      <LeaveCalendarView
        entries={[
          entry({}),
          entry({
            requestId: 'r2',
            employeeName: 'Arun Das',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            halfDay: true,
            days: 0.5,
            status: 'pending',
          }),
        ]}
      />,
    );

    const grid = within(screen.getByTestId('leave-calendar-grid'));
    expect(grid.getAllByText('Priya Raman')).toHaveLength(2); // 10 and 11 Nov
    expect(grid.getByText('Pending: Arun Das')).toBeInTheDocument();
    const list = within(screen.getByTestId('leave-calendar-list'));
    expect(list.getByText(/Half day · Pending/)).toBeInTheDocument();
    expect(list.getByText(/2 days · Approved/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  describe('the On leave today panel', () => {
    const NOW = new Date(2026, 10, 23);

    it('lists who is on leave today with type, half or full day and status', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
      render(
        <LeaveCalendarView
          entries={[]}
          todayEntries={[
            entry({
              requestId: 't1',
              employeeName: 'Zoya Khan',
              startDate: '2026-11-23',
              endDate: '2026-11-23',
              days: 1,
            }),
            entry({
              requestId: 't2',
              employeeName: 'Arun Das',
              leaveTypeName: 'Casual Leave',
              startDate: '2026-11-23',
              endDate: '2026-11-23',
              halfDay: true,
              days: 0.5,
              status: 'pending',
            }),
          ]}
        />,
      );

      const panel = within(screen.getByTestId('leave-today-panel'));
      expect(panel.getByTestId('leave-today-count')).toHaveTextContent('2 people on leave');
      const rows = panel.getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Arun Das');
      expect(rows[0]).toHaveTextContent('Casual Leave · Half day · Pending');
      expect(rows[1]).toHaveTextContent('Zoya Khan');
      expect(rows[1]).toHaveTextContent('Sick Leave · Full day · Approved');
      vi.useRealTimers();
    });

    it('says nobody is on leave, and shows a holiday today', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
      render(
        <LeaveCalendarView
          entries={[]}
          holidays={[
            { id: 'h', date: '2026-11-23', name: 'Founders Day' },
            { id: 'later', date: '2026-12-25', name: 'Year End Day' },
          ]}
        />,
      );
      expect(screen.getByTestId('leave-today-empty')).toBeInTheDocument();
      expect(screen.getByTestId('leave-today-holiday')).toHaveTextContent(
        'Holiday today: Founders Day',
      );
      vi.useRealTimers();
    });

    it('does not change when another month is shown', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
      render(
        <LeaveCalendarView
          entries={[]}
          todayEntries={[entry({ startDate: '2026-11-23', endDate: '2026-11-23' })]}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
      expect(screen.getByTestId('leave-today-count')).toHaveTextContent('1 person on leave');
      vi.useRealTimers();
    });

    it('shows the failure instead of claiming nobody is on leave', () => {
      render(<LeaveCalendarView entries={[]} todayError="Could not load" />);
      expect(screen.getByTestId('leave-today-error')).toHaveTextContent('Could not load');
      expect(screen.queryByTestId('leave-today-empty')).not.toBeInTheDocument();
    });
  });
});
