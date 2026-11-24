// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamLeadDashboard } from '../TeamLeadDashboard';
import * as employeeApi from '../../features/employees/api/employees';
import * as tasksApi from '../../features/tasks/api/tasksApi';
import * as attendanceApi from '../../features/attendance/api/attendance';
import * as approvalsApi from '../../features/approvals/api/approvals';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useInRouterContext: () => true,
  };
});

vi.mock('../../auth/AuthContext', () => {
  const user = {
    id: 'usr-lead-1',
    name: 'Mohamed Azad',
    email: 'lead@maxr.internal',
    role: 'team_lead',
    employeeId: 'emp-lead-1',
    department: 'Engineering',
    title: 'Engineering Team Lead',
    roles: ['team_lead'],
    permissions: [],
    avatarInitials: 'MA',
  };
  return {
    useAuth: () => ({
      user,
      role: 'team_lead',
      isAuthenticated: true,
    }),
    AuthContext: React.createContext({
      user,
      role: 'team_lead',
      isAuthenticated: true,
    }),
  };
});

describe('TeamLeadDashboard Component (Reference Match)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(employeeApi, 'fetchEmployeeDirectory').mockResolvedValue({
      data: [
        {
          id: 'emp-1',
          firstName: 'Alex',
          lastName: 'Mercer',
          email: 'alex@maxr.internal',
          phone: '+1234567890',
          employeeCode: 'EMP-001',
          status: 'active',
          joiningDate: '2026-01-01',
          createdAt: '',
          updatedAt: '',
          photoUrl: null,
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des1', title: 'Software Engineer' },
          manager: null,
        },
        {
          id: 'emp-2',
          firstName: 'Kavita',
          lastName: 'Nair',
          email: 'kavita@maxr.internal',
          phone: '+1234567891',
          employeeCode: 'EMP-002',
          status: 'active',
          joiningDate: '2026-01-01',
          createdAt: '',
          updatedAt: '',
          photoUrl: null,
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des2', title: 'QA Engineer' },
          manager: null,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 12, totalPages: 1 },
    });

    vi.spyOn(tasksApi, 'fetchMyTasks').mockResolvedValue({
      data: [
        {
          id: 't-1',
          title: 'Review pull requests',
          description: 'Review team code',
          status: 'in_progress',
          priority: 'high',
          dueDate: '2026-11-30',
          isDaily: false,
          isOverdue: false,
          assigneeEmployeeId: 'emp-lead-1',
          assigneeName: 'Mohamed Azad',
          assignerEmployeeId: 'emp-lead-1',
          assignerName: 'Mohamed Azad',
          projectId: null,
          projectName: null,
          completedAt: null,
          createdAt: '2026-11-20',
          updatedAt: '2026-11-20',
          version: 1,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 4 },
    });

    vi.spyOn(tasksApi, 'fetchTeamTasks').mockResolvedValue({
      data: [
        {
          id: 'tt-1',
          title: 'Refactor auth session tokens',
          description: 'Session tokens',
          status: 'in_progress',
          priority: 'high',
          dueDate: '2026-04-16',
          isDaily: false,
          isOverdue: false,
          assigneeEmployeeId: 'emp-1',
          assigneeName: 'Alex Mercer',
          assignerEmployeeId: 'emp-lead-1',
          assignerName: 'Mohamed Azad',
          projectId: null,
          projectName: null,
          completedAt: null,
          createdAt: '2026-11-20',
          updatedAt: '2026-11-20',
          version: 1,
        },
        {
          id: 'tt-2',
          title: 'PostgreSQL migration',
          description: 'DB migration',
          status: 'in_review',
          priority: 'medium',
          dueDate: '2026-04-15',
          isDaily: false,
          isOverdue: false,
          assigneeEmployeeId: 'emp-2',
          assigneeName: 'Kavita Nair',
          assignerEmployeeId: 'emp-lead-1',
          assignerName: 'Mohamed Azad',
          projectId: null,
          projectName: null,
          completedAt: null,
          createdAt: '2026-11-20',
          updatedAt: '2026-11-20',
          version: 1,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 28 },
    });

    vi.spyOn(approvalsApi, 'fetchApprovals').mockResolvedValue({
      data: [
        {
          id: 'app-1',
          subjectType: 'leave',
          subjectId: 's1',
          requesterEmployeeId: 'emp-1',
          requesterManagerId: 'emp-lead-1',
          requesterName: 'Alex Mercer',
          stages: ['manager'],
          currentStage: 1,
          status: 'pending',
          decisions: [],
          createdAt: '2026-11-20T00:00:00.000Z',
          decidedAt: null,
        },
        {
          id: 'app-2',
          subjectType: 'attendance_correction',
          subjectId: 's2',
          requesterEmployeeId: 'emp-2',
          requesterManagerId: 'emp-lead-1',
          requesterName: 'Kavita Nair',
          stages: ['manager'],
          currentStage: 1,
          status: 'pending',
          decisions: [],
          createdAt: '2026-11-20T00:00:00.000Z',
          decidedAt: null,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 6, totalPages: 1 },
    });

    vi.spyOn(attendanceApi, 'fetchTeamAttendance').mockResolvedValue({
      data: [
        {
          id: 'att-1',
          employeeId: 'emp-1',
          workDate: '2026-11-24',
          checkInTime: '2026-11-24T09:00:00Z',
          checkOutTime: null,
          durationMinutes: null,
          breaks: [],
          breakMinutes: 0,
          status: 'present',
          location: null,
          checkOutLocation: null,
          hasCheckInPhoto: false,
          hasCheckOutPhoto: false,
          notes: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'att-2',
          employeeId: 'emp-2',
          workDate: '2026-11-24',
          checkInTime: '2026-11-24T09:45:00Z',
          checkOutTime: null,
          durationMinutes: null,
          breaks: [],
          breakMinutes: 0,
          status: 'late',
          location: null,
          checkOutLocation: null,
          hasCheckInPhoto: false,
          hasCheckOutPhoto: false,
          notes: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 2 },
    });
  });

  it('renders the header with greeting, lead name, and designation', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('team-lead-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Mohamed Azad')).toBeInTheDocument();
    expect(screen.getByText(/Engineering Team Lead/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Here's your team's progress, tasks, and approvals/i),
    ).toBeInTheDocument();
  });

  it('renders four top KPI cards with correct metrics and badges', async () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    // KPI 1: Team Size
    expect(screen.getByText('Team Size')).toBeInTheDocument();
    expect(screen.getByText('+2 this month', { exact: false })).toBeInTheDocument();

    // KPI 2: My Tasks
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThan(0);

    // KPI 3: Team Tasks
    expect(screen.getByText('Team Tasks')).toBeInTheDocument();

    // KPI 4: Pending Approvals
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
  });

  it('renders Team Task Overview with donut chart and status legends', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Team Task Overview')).toBeInTheDocument();
    expect(screen.getByText('This Sprint')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hold').length).toBeGreaterThan(0);
  });

  it('renders Attendance (Today) card with breakdown', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Attendance (Today)')).toBeInTheDocument();
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
  });

  it('renders Team Performance card with 3D illustration', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Team Performance')).toBeInTheDocument();
    expect(screen.getByLabelText('Team Performance Illustration')).toBeInTheDocument();
  });

  it('renders Active Team Tasks table with tasks and status badges', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Active Team Tasks')).toBeInTheDocument();
    expect(screen.getByText('Refactor auth session tokens')).toBeInTheDocument();
    expect(screen.getByText('Alex Mercer')).toBeInTheDocument();
  });

  it('navigates when clicking KPI cards', () => {
    render(
      <MemoryRouter>
        <TeamLeadDashboard />
      </MemoryRouter>,
    );

    const teamSizeCard = screen.getByLabelText('Team Size KPI Card');
    fireEvent.click(teamSizeCard);
    expect(mockNavigate).toHaveBeenCalledWith('/lead/team');

    const myTasksCard = screen.getByLabelText('My Tasks KPI Card');
    fireEvent.click(myTasksCard);
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');

    const teamTasksCard = screen.getByLabelText('Team Tasks KPI Card');
    fireEvent.click(teamTasksCard);
    expect(mockNavigate).toHaveBeenCalledWith('/lead/tasks');

    const pendingApprovalsCard = screen.getByLabelText('Pending Approvals KPI Card');
    fireEvent.click(pendingApprovalsCard);
    expect(mockNavigate).toHaveBeenCalledWith('/lead/approvals');
  });
});
