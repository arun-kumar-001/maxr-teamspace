/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterTab } from '../components/RosterTab';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';

const mockEmployees: EmployeeDirectoryItem[] = [
  {
    id: 'emp-1',
    employeeCode: 'EMP001',
    firstName: 'Arun',
    lastName: 'Kumar',
    workEmail: 'arun@example.com',
    status: 'ACTIVE',
    department: { id: 'dept-1', name: 'Engineering' },
    designation: { id: 'des-1', title: 'Engineering Director' },
  },
  {
    id: 'emp-2',
    employeeCode: 'EMP002',
    firstName: 'Rajesh',
    lastName: 'Patel',
    workEmail: 'rajesh@example.com',
    status: 'ACTIVE',
    department: { id: 'dept-1', name: 'Engineering' },
    designation: { id: 'des-2', title: 'Staff Engineer' },
  },
];

const mockDepartments: DepartmentItem[] = [
  { id: 'dept-1', name: 'Engineering', code: 'ENG', employeeCount: 2 },
];

describe('RosterTab Compact Grid & Real-Time Check-In/Out Display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders week view with real-time check-in and check-out times and off days', () => {
    render(
      <RosterTab
        employees={mockEmployees}
        departments={mockDepartments}
        shifts={[]}
        selectedDate="2026-11-03"
        canManageRoster={true}
      />,
    );

    // Verify employee rows render
    expect(screen.getByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();

    // Verify real-time check-in & check-out times are displayed (e.g. 09:xx – 19:xx)
    const timeCells = screen.getAllByRole('button').filter((b) => b.textContent?.includes('–'));
    expect(timeCells.length).toBeGreaterThan(0);

    // Verify weekend off badges are displayed cleanly
    const offBadges = screen.getAllByText('Off');
    expect(offBadges.length).toBeGreaterThan(0);

    // Verify bottom legend has clean attendance status indicators
    expect(screen.getByText('Completed (Check-In & Out)')).toBeInTheDocument();
    expect(screen.getByText('Active (Currently In)')).toBeInTheDocument();
    expect(screen.getByText('Weekly Off')).toBeInTheDocument();

    // Verify table structure has proper accessible label
    const table = screen.getByLabelText('Attendance Shift Roster Grid');
    expect(table).toBeInTheDocument();
  });
});
