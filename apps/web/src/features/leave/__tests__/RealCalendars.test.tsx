// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type React from 'react';
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
    // once in the grid cell and once in the list
    expect(screen.getAllByText('Founders Day')).toHaveLength(2);
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
    expect(grid.getAllByText('Priya · SICK')).toHaveLength(2); // 10 and 11 Nov
    expect(grid.getByText('Pending: Arun · SICK ½')).toBeInTheDocument();
    const list = within(screen.getByTestId('leave-calendar-list'));
    expect(list.getByText(/Half day · Pending/)).toBeInTheDocument();
    expect(list.getByText(/2 days · Approved/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  describe('the month grid is meaningful at a glance', () => {
    const NOW = new Date(2026, 10, 23);
    const setup = (ui: React.ReactElement) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
      return render(ui);
    };

    it('shades weekends and shows a company holiday on its day', () => {
      setup(
        <LeaveCalendarView
          entries={[]}
          holidays={[{ id: 'h', date: '2026-11-26', name: 'Founders Day' }]}
        />,
      );
      expect(screen.getByTestId('leave-day-weekend-2026-11-28')).toBeInTheDocument(); // Saturday
      expect(screen.getByTestId('leave-day-weekend-2026-11-29')).toBeInTheDocument(); // Sunday
      expect(screen.queryByTestId('leave-day-weekend-2026-11-27')).not.toBeInTheDocument(); // Friday
      const grid = within(screen.getByTestId('leave-calendar-grid'));
      expect(grid.getByText('Holiday: Founders Day')).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('explains the colours in a legend', () => {
      setup(<LeaveCalendarView entries={[]} />);
      const legend = within(screen.getByTestId('leave-calendar-legend'));
      expect(legend.getByText('Waiting for approval')).toBeInTheDocument();
      expect(legend.getByText('Weekend')).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('opens the details of a day with everyone on leave, not only the first three', () => {
      const four = ['Asha', 'Bala', 'Chitra', 'Devi'].map((n, i) =>
        entry({
          requestId: `r${i}`,
          employeeId: `e${i}`,
          employeeName: `${n} Kumar`,
          startDate: '2026-11-24',
          endDate: '2026-11-24',
          days: 1,
        }),
      );
      setup(<LeaveCalendarView entries={four} />);
      const grid = within(screen.getByTestId('leave-calendar-grid'));
      expect(grid.getByText('+1 more')).toBeInTheDocument();
      expect(grid.queryByText('Devi · SICK')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Details for Tue, 24 Nov 2026/ }));
      const detail = within(screen.getByTestId('leave-day-detail'));
      expect(detail.getAllByRole('listitem')).toHaveLength(4);
      expect(detail.getByText('Devi Kumar')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('leave-day-detail')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('shows the holiday in the details of its day', () => {
      setup(
        <LeaveCalendarView
          entries={[]}
          holidays={[{ id: 'h', date: '2026-11-26', name: 'Founders Day' }]}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Details for Thu, 26 Nov 2026/ }));
      const detail = screen.getByTestId('leave-day-detail');
      expect(detail).toHaveTextContent('Holiday: Founders Day');
      expect(detail).not.toHaveTextContent('Nobody is on leave this day.');
      vi.useRealTimers();
    });

    it('says nobody is on leave on an empty day', () => {
      setup(<LeaveCalendarView entries={[]} />);
      fireEvent.click(screen.getByRole('button', { name: /Details for Wed, 25 Nov 2026/ }));
      expect(screen.getByTestId('leave-day-detail')).toHaveTextContent(
        'Nobody is on leave this day.',
      );
      vi.useRealTimers();
    });

    it('narrows to my own leave only when asked, and offers the toggle only when I am known', () => {
      const mine = entry({ requestId: 'm', employeeId: 'me', employeeName: 'Me Myself' });
      const other = entry({ requestId: 'o', employeeId: 'x', employeeName: 'Somebody Else' });
      const { rerender } = setup(<LeaveCalendarView entries={[mine, other]} />);
      expect(screen.queryByTestId('leave-only-mine')).not.toBeInTheDocument();

      rerender(<LeaveCalendarView entries={[mine, other]} myEmployeeId="me" />);
      const list = within(screen.getByTestId('leave-calendar-list'));
      expect(list.getByText('Somebody Else')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('leave-only-mine'));
      expect(list.queryByText('Somebody Else')).not.toBeInTheDocument();
      expect(list.getByText('Me Myself')).toBeInTheDocument();
      vi.useRealTimers();
    });
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
