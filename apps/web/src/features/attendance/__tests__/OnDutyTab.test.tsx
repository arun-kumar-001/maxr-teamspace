/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { OnDutyTab } from '../components/OnDutyTab';
import { TimesheetsTab } from '../components/TimesheetsTab';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';
import type { AttendanceRecord } from '../types';

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

const mockRecords: AttendanceRecord[] = [
  {
    id: 'rec-1',
    employeeId: 'emp-1',
    employeeName: 'Arun Kumar',
    date: '2026-11-13',
    checkInTime: '2026-11-13T09:05:00.000Z',
    checkOutTime: '2026-11-13T18:15:00.000Z',
    durationMinutes: 550,
    status: 'present',
    source: 'web',
  },
  // emp-2 has no punch (absent / not checked in)
];

describe('OnDutyTab Component & Attendance Status Chart', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders OnDutyTab with RosterTab-style employee column, "None" for empty punches, and no Shift column', () => {
    render(
      <BrowserRouter>
        <OnDutyTab
          records={mockRecords}
          employees={mockEmployees}
          departments={mockDepartments}
          shifts={[]}
          leaveEntries={[]}
          selectedDate="2026-11-13"
          canManageAttendance={true}
          onRequestCorrection={vi.fn()}
        />
      </BrowserRouter>,
    );

    // 1. Employee names and designations (RosterTab style)
    expect(screen.getByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('Engineering Director')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();

    // 2. Shift column should be absent
    expect(screen.queryByRole('columnheader', { name: /^Shift$/i })).not.toBeInTheDocument();

    // 3. For emp-2 (not checked in), displays "None" for check-in, check-out, and hours
    const noneElements = screen.getAllByText('None');
    expect(noneElements.length).toBeGreaterThanOrEqual(2);

    // 4. Attendance Status chart exists with On Time, Late, Absent
    expect(screen.getByText('Attendance Status')).toBeInTheDocument();
    expect(screen.getByText('On time, late & absent today')).toBeInTheDocument();
    expect(screen.getByText('On Time')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(screen.getAllByText('Absent').length).toBeGreaterThanOrEqual(1);
  });

  it('filters table rows when clicking Attendance Status chart bars', () => {
    render(
      <BrowserRouter>
        <OnDutyTab
          records={mockRecords}
          employees={mockEmployees}
          departments={mockDepartments}
          shifts={[]}
          leaveEntries={[]}
          selectedDate="2026-11-13"
          canManageAttendance={true}
          onRequestCorrection={vi.fn()}
        />
      </BrowserRouter>,
    );

    // Click Absent bar
    const absentBars = screen.getAllByTitle(/Click to filter Absent/i);
    fireEvent.click(absentBars[0]);

    // Filter pill appears
    expect(screen.getByText(/Filter: Absent/i)).toBeInTheDocument();

    // Only Rajesh Patel is absent
    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();
    expect(screen.queryByText('Arun Kumar')).not.toBeInTheDocument();
  });
});

describe('TimesheetsTab Component', () => {
  it('renders timesheets table with bulk approval and export buttons', () => {
    render(
      <TimesheetsTab
        records={mockRecords}
        employees={mockEmployees}
        departments={mockDepartments}
        canApproveTimesheets={true}
      />,
    );

    expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Approve/i }).length).toBeGreaterThanOrEqual(1);
  });
});
