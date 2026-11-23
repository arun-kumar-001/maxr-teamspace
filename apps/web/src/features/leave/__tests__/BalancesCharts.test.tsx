// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
import type { LeaveBalance, LeavePolicy } from '../types';

afterEach(cleanup);

const balance = (code: string, name: string, allotted: number, used: number): LeaveBalance => ({
  leaveTypeId: code,
  code,
  name,
  year: 2026,
  allotted,
  carriedForward: 0,
  used,
  remaining: allotted - used,
});

describe('My Leave Balances charts', () => {
  const three = [
    balance('ANNUAL', 'Annual leave', 18, 4),
    balance('CASUAL', 'Casual leave', 6, 6),
    balance('SICK', 'Sick leave', 12, 0),
  ];

  it('draws a bar per leave type with its own colour and its count', () => {
    render(<LeaveBalancesSummary balances={three} year={2026} />);
    const bars = within(screen.getByTestId('leave-balances-bars'));

    expect(bars.getByTestId('leave-type-bar-ANNUAL')).toHaveTextContent('4 used · 14 left of 18');
    expect(bars.getByTestId('leave-type-bar-CASUAL')).toHaveTextContent('6 used · 0 left of 6');
    expect(bars.getByTestId('leave-type-bar-SICK')).toHaveTextContent('0 used · 12 left of 12');

    expect(bars.getByTestId('leave-type-fill-ANNUAL')).toHaveStyle({ width: '22%' });
    expect(bars.getByTestId('leave-type-fill-CASUAL')).toHaveStyle({ width: '100%' });
    expect(bars.getByTestId('leave-type-fill-SICK')).toHaveStyle({ width: '0%' });

    const colours = ['ANNUAL', 'CASUAL', 'SICK'].map(
      (code) => bars.getByTestId(`leave-type-fill-${code}`).className.match(/bg-chart-\d/)?.[0],
    );
    expect(new Set(colours).size).toBe(3);
    expect(colours.every(Boolean)).toBe(true);
  });

  it('shows used and balance in the donut, from the balances given', () => {
    render(<LeaveBalancesSummary balances={three} year={2026} />);
    const donut = within(screen.getByTestId('leave-balances-donut'));
    const totals = within(screen.getByTestId('leave-balances-totals'));

    expect(totals.getByText('Used').nextElementSibling).toHaveTextContent('10');
    expect(totals.getByText('Balance').nextElementSibling).toHaveTextContent('26');
    expect(totals.getByText('Total entitlement').nextElementSibling).toHaveTextContent('36');
    expect(donut.getByRole('img')).toHaveAccessibleName('10 days used, 26 days balance, of 36');
    const used = screen.getByTestId('leave-donut-used').getAttribute('stroke-dasharray') ?? '';
    const [arc, whole] = used.split(' ').map(Number) as [number, number];
    expect(arc / whole).toBeCloseTo(10 / 36, 3);
  });

  it('draws no used arc when nothing was used', () => {
    render(<LeaveBalancesSummary balances={[balance('SICK', 'Sick leave', 12, 0)]} year={2026} />);
    expect(screen.queryByTestId('leave-donut-used')).not.toBeInTheDocument();
  });

  it('lists a type without a yearly balance in the chart without a bar or invented numbers', () => {
    const policies = [
      {
        id: 'pm',
        code: 'PM',
        name: 'Short Permission',
        hasBalance: false,
        isActive: true,
        annualDays: 0,
        carryForwardMax: 0,
        allowHalfDay: false,
        maxBackdateDays: 0,
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
      } as LeavePolicy,
    ];
    render(<LeaveBalancesSummary balances={[]} policies={policies} year={2026} />);
    const row = screen.getByTestId('leave-type-bar-PM');
    expect(row).toHaveTextContent('No yearly limit');
    expect(screen.queryByTestId('leave-type-fill-PM')).not.toBeInTheDocument();
  });
});
