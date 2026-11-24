// @vitest-environment jsdom
import React, { type ComponentProps } from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../auth/AuthContext';
import { TeamLeadDashboard } from '../TeamLeadDashboard';
import * as employeeApi from '../../features/employees/api/employees';
import * as tasksApi from '../../features/tasks/api/tasksApi';
import * as attendanceApi from '../../features/attendance/api/attendance';
import * as approvalsApi from '../../features/approvals/api/approvals';
import type { Task, TaskStatus } from '../../features/tasks/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../auth/AuthContext', () => {
  const user = {
    id: 'usr-lead-1',
    name: 'Priya Lead',
    email: 'lead@maxr.internal',
    role: 'team_lead',
    employeeId: 'emp-lead-1',
    department: 'Engineering',
    title: 'Engineering Team Lead',
    roles: ['team_lead'],
    permissions: [],
    avatarInitials: 'PL',
  };
  const value = { user, role: 'team_lead', isAuthenticated: true };
  return { useAuth: () => value, AuthContext: React.createContext(value) };
});

const task = (id: string, title: string, status: TaskStatus, dueDate: string, who: string): Task =>
  ({
    id,
    title,
    description: '',
    status,
    priority: 'medium',
    dueDate,
    isDaily: false,
    isOverdue: false,
    assigneeEmployeeId: `emp-${who}`,
    assigneeName: who,
    assignerEmployeeId: 'emp-lead-1',
    assignerName: 'Priya Lead',
    projectId: null,
    projectName: null,
    completedAt: null,
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    version: 1,
  }) as Task;

const employee = (id: string, first: string, status = 'active') => ({
  id,
  firstName: first,
  lastName: 'Test',
  email: `${first.toLowerCase()}@maxr.internal`,
  phone: null,
  employeeCode: id.toUpperCase(),
  status,
  joiningDate: '2026-01-01',
  createdAt: '',
  updatedAt: '',
  photoUrl: null,
  department: { id: 'd1', name: 'Engineering', code: 'ENG' },
  designation: { id: 'des1', title: 'Engineer' },
  manager: null,
});

const attendance = (id: string, employeeId: string, status: string) => ({
  id,
  employeeId,
  workDate: '2026-11-24',
  checkInTime: '2026-11-24T09:00:00Z',
  checkOutTime: null,
  durationMinutes: null,
  breaks: [],
  breakMinutes: 0,
  status,
  location: null,
  checkOutLocation: null,
  hasCheckInPhoto: false,
  hasCheckOutPhoto: false,
  notes: null,
  createdAt: '',
  updatedAt: '',
});

const approval = (id: string, subjectType: string) => ({
  id,
  subjectType,
  subjectId: `s-${id}`,
  requesterEmployeeId: 'emp-1',
  requesterManagerId: 'emp-lead-1',
  requesterName: 'Asha',
  stages: ['manager'],
  currentStage: 1,
  status: 'pending',
  decisions: [],
  createdAt: '2026-11-20T00:00:00.000Z',
  decidedAt: null,
});

const page = <T,>(data: T[]) => ({ data, meta: { page: 1, pageSize: 100, total: data.length } });

function mockData() {
  vi.spyOn(employeeApi, 'fetchEmployeeDirectory').mockResolvedValue(
    page([
      employee('emp-1', 'Asha'),
      employee('emp-2', 'Ravi'),
      employee('emp-3', 'Meena', 'deactivated'),
    ]) as never,
  );
  vi.spyOn(tasksApi, 'fetchMyTasks').mockResolvedValue(
    page([task('m1', 'Review pull requests', 'in_progress', '2026-11-30', 'Priya')]) as never,
  );
  vi.spyOn(tasksApi, 'fetchTeamTasks').mockResolvedValue(
    page([
      task('t1', 'Rotate session keys', 'in_progress', '2026-11-26', 'Asha'),
      task('t2', 'Database upgrade', 'in_review', '2026-11-28', 'Ravi'),
      task('t3', 'Write release notes', 'todo', '2026-12-01', 'Meena'),
      task('t4', 'Old finished task', 'completed', '2026-11-01', 'Asha'),
    ]) as never,
  );
  vi.spyOn(approvalsApi, 'fetchApprovals').mockResolvedValue(
    page([approval('a1', 'leave'), approval('a2', 'attendance_correction')]) as never,
  );
  vi.spyOn(attendanceApi, 'fetchTeamAttendance').mockResolvedValue(
    page([attendance('r1', 'emp-1', 'present'), attendance('r2', 'emp-2', 'late')]) as never,
  );
}

function mockEmptyData() {
  vi.spyOn(employeeApi, 'fetchEmployeeDirectory').mockResolvedValue(page([]) as never);
  vi.spyOn(tasksApi, 'fetchMyTasks').mockResolvedValue(page([]) as never);
  vi.spyOn(tasksApi, 'fetchTeamTasks').mockResolvedValue(page([]) as never);
  vi.spyOn(approvalsApi, 'fetchApprovals').mockResolvedValue(page([]) as never);
  vi.spyOn(attendanceApi, 'fetchTeamAttendance').mockResolvedValue(page([]) as never);
}

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <TeamLeadDashboard />
    </MemoryRouter>,
  );

const kpi = (name: string) => screen.getByRole('button', { name });

describe('TeamLeadDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the lead name and title of the signed-in user', () => {
    mockData();
    renderDashboard();
    expect(screen.getByTestId('team-lead-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Priya Lead')).toBeInTheDocument();
    expect(screen.getByText('Engineering Team Lead')).toBeInTheDocument();
  });

  it('invents no name and no figures when the user is unknown and nothing has loaded yet', () => {
    const never = new Promise(() => undefined);
    vi.spyOn(employeeApi, 'fetchEmployeeDirectory').mockReturnValue(never as never);
    vi.spyOn(tasksApi, 'fetchMyTasks').mockReturnValue(never as never);
    vi.spyOn(tasksApi, 'fetchTeamTasks').mockReturnValue(never as never);
    vi.spyOn(approvalsApi, 'fetchApprovals').mockReturnValue(never as never);
    vi.spyOn(attendanceApi, 'fetchTeamAttendance').mockReturnValue(never as never);

    const anonymous = { user: undefined } as unknown as ComponentProps<
      typeof AuthContext.Provider
    >['value'];
    render(
      <AuthContext.Provider value={anonymous}>
        <MemoryRouter>
          <TeamLeadDashboard />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText('Team Lead')).toBeInTheDocument();
    expect(screen.queryByText(/Mohamed Azad|Alex Mercer|Kavita Nair/)).toBeNull();
    // Every card is a loading placeholder, not a number.
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(4);
    expect(within(kpi('Team Size KPI Card')).queryByText(/^\d+$/)).toBeNull();
    expect(within(kpi('Team Tasks KPI Card')).queryByText(/^\d+$/)).toBeNull();
  });

  it('shows the real numbers from the API in the four KPI cards', async () => {
    mockData();
    renderDashboard();

    await waitFor(() =>
      expect(within(kpi('Team Size KPI Card')).getByText('3')).toBeInTheDocument(),
    );
    expect(within(kpi('Team Size KPI Card')).getByText('2 active')).toBeInTheDocument();

    expect(within(kpi('My Tasks KPI Card')).getByText('1')).toBeInTheDocument();
    expect(within(kpi('My Tasks KPI Card')).getByText('1 In Progress')).toBeInTheDocument();

    expect(within(kpi('Team Tasks KPI Card')).getByText('4')).toBeInTheDocument();
    expect(within(kpi('Team Tasks KPI Card')).getByText('1 In Progress')).toBeInTheDocument();

    expect(within(kpi('Pending Approvals KPI Card')).getByText('2')).toBeInTheDocument();
    expect(
      within(kpi('Pending Approvals KPI Card')).getByText('1 Leave • 1 Attendance'),
    ).toBeInTheDocument();
  });

  it('draws the task overview from the real tasks, with To Do and Blocked as their own states', async () => {
    mockData();
    renderDashboard();

    const overview = (await screen.findByText('Team Task Overview')).closest('section')!;
    await within(overview).findByText('To Do');
    for (const label of ['Completed', 'In Progress', 'In Review', 'To Do', 'Blocked']) {
      expect(within(overview).getByText(label)).toBeInTheDocument();
    }
    expect(within(overview).queryByText('Hold')).toBeNull();
    // 4 tasks in total, one in each of completed, in progress, in review and to do.
    expect(within(overview).getByText('4')).toBeInTheDocument();
    expect(within(overview).getAllByText(/\(25%\)/)).toHaveLength(4);
  });

  it("splits today's attendance over the team", async () => {
    mockData();
    renderDashboard();

    const card = (await screen.findByText('Attendance (Today)')).closest('section')!;
    await within(card).findByText('2/3');
    const row = (label: string) => within(card).getByText(label).closest('li')!;
    expect(row('Present')).toHaveTextContent('1');
    expect(row('Late')).toHaveTextContent('1');
    expect(row('On leave')).toHaveTextContent('0');
    // Three team members, two checked in, nobody on leave: one is absent.
    expect(row('Absent')).toHaveTextContent('1');
  });

  it('lists open tasks soonest due first, leaves out finished ones and shows each status in words', async () => {
    mockData();
    renderDashboard();

    const card = (await screen.findByText('Active Team Tasks')).closest('section')!;
    await within(card).findByText('Rotate session keys');
    const titles = within(card)
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[1]!.textContent);
    expect(titles).toEqual(['Rotate session keys', 'Database upgrade', 'Write release notes']);
    expect(within(card).queryByText('Old finished task')).toBeNull();
    expect(within(card).getByText('In Progress')).toBeInTheDocument();
    expect(within(card).getByText('In Review')).toBeInTheDocument();
    expect(within(card).getByText('To Do')).toBeInTheDocument();
    expect(within(card).getByText('Nov 26, 2026')).toBeInTheDocument();
  });

  it('shows the completion rate from the tasks', async () => {
    mockData();
    renderDashboard();
    expect(await screen.findByText('25% achieved')).toBeInTheDocument();
    expect(screen.getByLabelText('Team Performance Illustration')).toBeInTheDocument();
  });

  it('shows zeros and plain empty messages, never sample data, when the team has nothing yet', async () => {
    mockEmptyData();
    renderDashboard();

    expect(
      await screen.findByText('No tasks have been assigned to your team yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/No active tasks/)).toBeInTheDocument();
    expect(within(kpi('Team Size KPI Card')).getByText('0')).toBeInTheDocument();
    expect(within(kpi('Team Tasks KPI Card')).getByText('0')).toBeInTheDocument();
    expect(within(kpi('Pending Approvals KPI Card')).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.queryByText(/Alex Mercer|Kavita Nair|Vikram Mehta|Charlotte Brown/)).toBeNull();
    expect(screen.queryByText('% achieved', { exact: false })).toBeNull();
  });

  it('tells the user when a card fails to load, keeps the other cards, and recovers on Retry', async () => {
    mockData();
    vi.spyOn(tasksApi, 'fetchTeamTasks')
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValue(
        page([task('t1', 'Rotate session keys', 'in_progress', '2026-11-26', 'Asha')]) as never,
      );
    renderDashboard();

    const overview = (await screen.findByText('Team Task Overview')).closest('section')!;
    await within(overview).findByRole('alert');
    expect(within(overview).getByText('Could not load this.')).toBeInTheDocument();
    // The failed number is a dash, not a made-up figure; the other cards still loaded.
    expect(within(kpi('Team Tasks KPI Card')).getAllByText('—').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(within(kpi('Team Size KPI Card')).getByText('3')).toBeInTheDocument(),
    );

    fireEvent.click(within(overview).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Could not load this.')).toBeNull());
    expect(await screen.findByText('Rotate session keys')).toBeInTheDocument();
    expect(tasksApi.fetchTeamTasks).toHaveBeenCalledTimes(2);
  });

  it('keeps the rest of the dashboard working when one request is refused', async () => {
    mockData();
    vi.spyOn(approvalsApi, 'fetchApprovals').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    renderDashboard();

    // Approvals only feed their own KPI card, which shows dashes instead of figures.
    await waitFor(() =>
      expect(within(kpi('Pending Approvals KPI Card')).getAllByText('—').length).toBeGreaterThan(0),
    );
    expect(await screen.findByText('Rotate session keys')).toBeInTheDocument();
    expect(within(kpi('Team Size KPI Card')).getByText('3')).toBeInTheDocument();
  });

  it('says access is denied, without a Retry button, on a card the API refuses with 403', async () => {
    mockData();
    vi.spyOn(tasksApi, 'fetchTeamTasks').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    renderDashboard();

    const overview = (await screen.findByText('Team Task Overview')).closest('section')!;
    expect(
      await within(overview).findByText('You do not have access to this information.'),
    ).toBeInTheDocument();
    expect(within(overview).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('asks for attendance on the local calendar day, not the UTC day', async () => {
    mockData();
    // 00:30 on 25 Nov in the machine's own time zone: still 24 Nov in UTC for anyone east of Greenwich.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 25, 0, 30));
    renderDashboard();

    await waitFor(() => expect(attendanceApi.fetchTeamAttendance).toHaveBeenCalled());
    expect(attendanceApi.fetchTeamAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-11-25', endDate: '2026-11-25' }),
    );
  });

  it('has no dead controls: no sprint filter and no date picker button', () => {
    mockData();
    renderDashboard();
    expect(screen.queryByLabelText('Filter tasks by sprint')).toBeNull();
    expect(screen.queryByText('This Sprint')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Date' })).toBeNull();
    expect(screen.queryByText(/\+2 this month/)).toBeNull();
  });

  it('opens the right page from each KPI card, and the cards are real buttons', () => {
    mockData();
    renderDashboard();

    const targets: Array<[string, string]> = [
      ['Team Size KPI Card', '/lead/team'],
      ['My Tasks KPI Card', '/tasks'],
      ['Team Tasks KPI Card', '/lead/tasks'],
      ['Pending Approvals KPI Card', '/lead/approvals'],
    ];
    for (const [name, path] of targets) {
      const card = kpi(name);
      expect(card.tagName).toBe('BUTTON');
      fireEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith(path);
    }
  });
});
