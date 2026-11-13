// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { CompanyCheckInOutTab } from '../components/CompanyCheckInOutTab';
import type { AttendanceRecord } from '../types';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';

describe('CompanyCheckInOutTab', () => {
  afterEach(() => {
    cleanup();
  });
  const mockDepartments: DepartmentItem[] = [
    { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    { id: 'dept-hr', name: 'Human Resources', code: 'HR' },
  ];

  const mockEmployees: EmployeeDirectoryItem[] = [
    {
      id: 'emp-1',
      employeeCode: 'EMP-0001',
      firstName: 'Arun',
      lastName: 'Kumar',
      email: 'arun@maxr.internal',
      phone: null,
      department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
      designation: { id: 'desig-lead', title: 'Tech Lead', code: 'TL', level: 3 },
      manager: null,
      status: 'active',
      joiningDate: '2024-01-01',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'emp-2',
      employeeCode: 'EMP-0002',
      firstName: 'Rajesh',
      lastName: 'Patel',
      email: 'rajesh@maxr.internal',
      phone: null,
      department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
      designation: { id: 'desig-eng', title: 'Senior Engineer', code: 'SE', level: 2 },
      manager: null,
      status: 'active',
      joiningDate: '2024-02-01',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
    },
    {
      id: 'emp-3',
      employeeCode: 'EMP-0003',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@maxr.internal',
      phone: null,
      department: { id: 'dept-hr', name: 'Human Resources', code: 'HR' },
      designation: { id: 'desig-hr', title: 'HR Manager', code: 'HRM', level: 3 },
      manager: null,
      status: 'active',
      joiningDate: '2024-03-01',
      createdAt: '2024-03-01T00:00:00.000Z',
      updatedAt: '2024-03-01T00:00:00.000Z',
    },
  ];

  const mockRecords: AttendanceRecord[] = [
    {
      id: 'rec-1',
      employeeId: 'emp-1',
      employeeName: 'Arun Kumar',
      workDate: '2026-11-03',
      checkInTime: '2026-11-03T09:00:00.000Z',
      checkOutTime: null,
      durationMinutes: 120,
      status: 'present',
      location: {
        latitude: 13.0827,
        longitude: 80.2707,
        address: 'Mount Road, Guindy, Chennai',
      },
      checkInPhoto: 'data:image/jpeg;base64,mockCheckInPhoto1',
      checkOutLocation: null,
      checkOutPhoto: null,
      breaks: [],
      notes: null,
      createdAt: '2026-11-03T09:00:00.000Z',
      updatedAt: '2026-11-03T09:00:00.000Z',
    },
    {
      id: 'rec-2',
      employeeId: 'emp-2',
      employeeName: 'Rajesh Patel',
      workDate: '2026-11-03',
      checkInTime: '2026-11-03T09:15:00.000Z',
      checkOutTime: '2026-11-03T18:00:00.000Z',
      durationMinutes: 525,
      status: 'present',
      location: {
        latitude: 13.0827,
        longitude: 80.2707,
        address: 'Anna Salai, Chennai',
      },
      checkOutLocation: {
        latitude: 13.0827,
        longitude: 80.2707,
        address: 'Anna Salai, Chennai',
      },
      checkInPhoto: 'data:image/jpeg;base64,mockCheckInPhoto2',
      checkOutPhoto: 'data:image/jpeg;base64,mockCheckOutPhoto2',
      breaks: [
        {
          startTime: '2026-11-03T13:00:00.000Z',
          endTime: '2026-11-03T13:45:00.000Z',
        },
      ],
      breakMinutes: 45,
      notes: null,
      createdAt: '2026-11-03T09:15:00.000Z',
      updatedAt: '2026-11-03T18:00:00.000Z',
    },
  ];

  it('renders admin KPIs with live counts of active, checked out, and pending employees', () => {
    render(
      <CompanyCheckInOutTab
        records={mockRecords}
        employees={mockEmployees}
        departments={mockDepartments}
        selectedDate="2026-11-03"
      />,
    );

    expect(screen.getByText('Currently Checked In')).toBeInTheDocument();
    expect(screen.getByText('Taking Break')).toBeInTheDocument();
    expect(screen.getByText('Completed Shift')).toBeInTheDocument();
    expect(screen.getAllByText('Not Checked In').length).toBeGreaterThan(0);

    // Check-in count = 1 (Arun Kumar active)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders all employees with their check-in and check-out statuses', () => {
    render(
      <CompanyCheckInOutTab
        records={mockRecords}
        employees={mockEmployees}
        departments={mockDepartments}
        selectedDate="2026-11-03"
      />,
    );

    // All employees appear
    expect(screen.getByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();

    // Street addresses
    expect(screen.getByText(/Mount Road, Guindy, Chennai/)).toBeInTheDocument();
    expect(screen.getAllByText(/Anna Salai, Chennai/).length).toBeGreaterThan(0);
  });

  it('allows filtering by status and searching employee name', () => {
    render(
      <CompanyCheckInOutTab
        records={mockRecords}
        employees={mockEmployees}
        departments={mockDepartments}
        selectedDate="2026-11-03"
      />,
    );

    // Search for Rajesh
    const searchInput = screen.getByPlaceholderText('Search employee...');
    fireEvent.change(searchInput, { target: { value: 'Rajesh' } });

    expect(screen.getByText('Rajesh Patel')).toBeInTheDocument();
    expect(screen.queryByText('Arun Kumar')).not.toBeInTheDocument();
    expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
  });

  it('opens details modal when clicking Details button', () => {
    render(
      <CompanyCheckInOutTab
        records={mockRecords}
        employees={mockEmployees}
        departments={mockDepartments}
        selectedDate="2026-11-03"
      />,
    );

    const detailsButtons = screen.getAllByText('Details');
    expect(detailsButtons.length).toBeGreaterThan(0);
    const firstButton = detailsButtons[0];
    if (!firstButton) throw new Error('No details button found');
    fireEvent.click(firstButton);

    expect(screen.getByText(/Attendance Session/)).toBeInTheDocument();
    expect(screen.getByText('Breaks History')).toBeInTheDocument();

    // Close button
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Breaks History')).not.toBeInTheDocument();
  });
});
