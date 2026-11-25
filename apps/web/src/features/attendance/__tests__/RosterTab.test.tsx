/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterTab } from '../components/RosterTab';
import type { AttendanceRecord } from '../types';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';

const mockEmployees: EmployeeDirectoryItem[] = [
  {
    id: 'emp-1',
    employeeCode: 'EMP001',
    firstName: 'Arun',
    lastName: 'Kumar',
    email: 'arun@example.com',
    phone: null,
    manager: null,
    joiningDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'active',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'des-1', title: 'Engineering Director' },
  },
  {
    id: 'emp-2',
    employeeCode: 'EMP002',
    firstName: 'Rajesh',
    lastName: 'Patel',
    email: 'rajesh@example.com',
    phone: null,
    manager: null,
    joiningDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'active',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'des-2', title: 'Staff Engineer' },
  },
];

const mockDepartments: DepartmentItem[] = [{ id: 'dept-1', name: 'Engineering', code: 'ENG' }];

const mockRecords: AttendanceRecord[] = [
  {
    id: 'att-1',
    employeeId: 'emp-1',
    workDate: '2026-11-03',
    checkInTime: '2026-11-03T09:00:00Z',
    checkOutTime: '2026-11-03T19:00:00Z',
    durationMinutes: 600,
    status: 'present',
    location: null,
    notes: null,
    createdAt: '2026-11-03T09:00:00Z',
    updatedAt: '2026-11-03T19:00:00Z',
  },
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
        initialRecords={mockRecords}
        canManageRoster={true}
      />,
    );

    // Verify employee rows render
    expect(screen.getByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();

    // Verify real-time check-in & check-out times are displayed when recorded (e.g. 09:xx – 19:xx)
    const timeCells = screen.getAllByRole('button').filter((b) => b.textContent?.includes('–'));
    expect(timeCells.length).toBeGreaterThan(0);

    // A past working day with no record is Absent (not blank), and no fake punch is invented
    expect(screen.getAllByText('Absent').length).toBeGreaterThan(0);

    // Verify weekend off badges are displayed cleanly
    const offBadges = screen.getAllByText('Off');
    expect(offBadges.length).toBeGreaterThan(0);

    // Verify table structure has proper accessible label
    const table = screen.getByLabelText('Attendance Shift Roster Grid');
    expect(table).toBeInTheDocument();
  });

  it('keeps days that have not happened yet blank instead of marking them absent', () => {
    render(
      <RosterTab
        employees={mockEmployees}
        departments={mockDepartments}
        shifts={[]}
        selectedDate="2099-01-06"
        initialRecords={[]}
        canManageRoster={true}
      />,
    );

    expect(screen.queryByText('Absent')).toBeNull();
    const blankCells = screen.getAllByRole('button').filter((b) => b.textContent === '—');
    expect(blankCells.length).toBeGreaterThan(0);
  });

  it("shows an employee's photo in the employee column when there is one", () => {
    const withPhoto = mockEmployees.map((e, i) =>
      i === 0 ? { ...e, photoUrl: '/api/v1/employees/photo-1/photo?v=7' } : e,
    );
    const { container } = render(
      <RosterTab
        employees={withPhoto}
        departments={mockDepartments}
        shifts={[]}
        selectedDate="2026-11-03"
        initialRecords={mockRecords}
        canManageRoster={true}
      />,
    );

    expect(
      container.querySelector('img[src="/api/v1/employees/photo-1/photo?v=7"]'),
    ).not.toBeNull();
  });
});
