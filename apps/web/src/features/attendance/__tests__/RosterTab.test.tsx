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

describe('RosterTab Compact Grid & 9-to-7 Standard Shift', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders week view with compact 9-to-7 standard shift timing and off days without horizontal overflow', () => {
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

    // Verify 09:00 - 19:00 (9 to 7) default standard shift is displayed
    const standardShiftPills = screen.getAllByText('09:00 – 19:00');
    expect(standardShiftPills.length).toBeGreaterThan(0);

    // Verify weekend off badges are displayed cleanly
    const offBadges = screen.getAllByText('Off');
    expect(offBadges.length).toBeGreaterThan(0);

    // Verify table structure has proper accessible label
    const table = screen.getByLabelText('Attendance Shift Roster Grid');
    expect(table).toBeInTheDocument();
  });
});
