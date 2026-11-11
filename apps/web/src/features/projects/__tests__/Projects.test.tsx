// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { ProjectsListPage } from '../pages/ProjectsListPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import * as projectsApi from '../api/projectsApi';
import * as employeesApi from '../../employees/api/employees';
import type { Project, ProjectDetail } from '../types';

vi.mock('../api/projectsApi', async () => {
  const actual = await vi.importActual<typeof projectsApi>('../api/projectsApi');
  return {
    ...actual,
    fetchProjects: vi.fn(),
    fetchProjectById: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    addProjectMember: vi.fn(),
    removeProjectMember: vi.fn(),
    createProjectMilestone: vi.fn(),
    updateProjectMilestone: vi.fn(),
    createProjectUpdate: vi.fn(),
    uploadProjectDocument: vi.fn(),
    getProjectDocumentDownloadLink: vi.fn(),
    deleteProjectDocument: vi.fn(),
  };
});

vi.mock('../../employees/api/employees', async () => {
  const actual = await vi.importActual<typeof employeesApi>('../../employees/api/employees');
  return {
    ...actual,
    fetchEmployeeDirectory: vi.fn(),
  };
});

const mockProjects: Project[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'PRJ-ALPHA',
    name: 'Alpha Redesign Initiative',
    description: 'Major redesign of corporate customer experience portal.',
    status: 'active',
    ownerEmployeeId: '22222222-2222-2222-2222-222222222222',
    ownerName: 'Sarah Connor',
    startDate: '2026-01-15',
    endDate: '2026-06-30',
    version: 1,
    memberCount: 3,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    code: 'PRJ-BETA',
    name: 'Beta Cloud Migration',
    description: 'Relocate legacy storage to private cantobo encrypted servers.',
    status: 'archived',
    ownerEmployeeId: '44444444-4444-4444-4444-444444444444',
    ownerName: 'John Doe',
    startDate: '2025-05-01',
    endDate: '2025-11-30',
    version: 2,
    memberCount: 2,
    createdAt: '2025-05-01T09:00:00Z',
    updatedAt: '2025-11-30T17:00:00Z',
  },
];

const mockProjectDetail: ProjectDetail = {
  ...mockProjects[0]!,
  members: [
    {
      employeeId: '22222222-2222-2222-2222-222222222222',
      name: 'Sarah Connor',
      addedAt: '2026-01-15T09:00:00Z',
    },
    {
      employeeId: '55555555-5555-5555-5555-555555555555',
      name: 'Kyle Reese',
      addedAt: '2026-01-16T10:00:00Z',
    },
    {
      employeeId: '66666666-6666-6666-6666-666666666666',
      name: 'Miles Dyson',
      addedAt: '2026-01-17T11:00:00Z',
    },
  ],
};

describe('Projects Feature (Issue #42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: mockProjects,
      meta: { page: 1, pageSize: 20, total: 2 },
    });

    vi.mocked(projectsApi.fetchProjectById).mockResolvedValue(mockProjectDetail);

    vi.mocked(employeesApi.fetchEmployeeDirectory).mockResolvedValue({
      data: [
        {
          id: '77777777-7777-7777-7777-777777777777',
          employeeCode: 'EMP-007',
          firstName: 'James',
          lastName: 'Bond',
          email: 'jbond@example.com',
          phone: '+1555007',
          status: 'active',
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des1', title: 'Senior Specialist', code: 'SR-SPEC', level: 3 },
          manager: null,
          joiningDate: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
  });

  it('renders project list with cards, codes, and status badges', async () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProjectsListPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PRJ-ALPHA')).toBeInTheDocument();
      expect(screen.getByText('Alpha Redesign Initiative')).toBeInTheDocument();
      expect(screen.getByText('PRJ-BETA')).toBeInTheDocument();
      expect(screen.getByText('Beta Cloud Migration')).toBeInTheDocument();
    });

    expect(screen.getByTestId('projects-grid')).toBeInTheDocument();
    expect(
      screen.getByTestId('project-card-11111111-1111-1111-1111-111111111111'),
    ).toBeInTheDocument();
  });

  it('filters project list by search term', async () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProjectsListPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Redesign Initiative')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search projects by name or code/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    await waitFor(() => {
      expect(projectsApi.fetchProjects).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Alpha' }),
        expect.any(AbortSignal),
      );
    });
  });

  it('allows Admin to open Create Project modal and submits creation', async () => {
    const createdProject: ProjectDetail = {
      id: '88888888-8888-8888-8888-888888888888',
      code: 'PRJ-GAMMA',
      name: 'Gamma Testing Platform',
      description: 'Automated test harness platform.',
      status: 'active',
      ownerEmployeeId: '22222222-2222-2222-2222-222222222222',
      ownerName: 'Admin User',
      startDate: '2026-03-01',
      endDate: '2026-09-01',
      version: 1,
      memberCount: 1,
      members: [],
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    vi.mocked(projectsApi.createProject).mockResolvedValue(createdProject);

    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProjectsListPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-create-project-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('header-create-project-btn'));

    expect(screen.getByText('Create New Project')).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText('e.g. PRJ-ALPHA');
    const nameInput = screen.getByPlaceholderText('e.g. Mobile App Redesign');

    fireEvent.change(codeInput, { target: { value: 'PRJ-GAMMA' } });
    fireEvent.change(nameInput, { target: { value: 'Gamma Testing Platform' } });

    fireEvent.click(screen.getByTestId('submit-project-btn'));

    await waitFor(() => {
      expect(projectsApi.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PRJ-GAMMA',
          name: 'Gamma Testing Platform',
        }),
      );
    });
  });

  it('renders project detail view with owner and members list', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument();
      expect(screen.getByText('Alpha Redesign Initiative')).toBeInTheDocument();
      expect(screen.getAllByText('Sarah Connor').length).toBe(2);
      expect(screen.getByText('Kyle Reese')).toBeInTheDocument();
      expect(screen.getByText('Miles Dyson')).toBeInTheDocument();
    });

    // The owner's row should indicate Owner badge and not show remove button
    expect(screen.getByTestId('member-row-22222222-2222-2222-2222-222222222222')).toHaveTextContent(
      'Owner',
    );
    expect(screen.queryByTestId('remove-member-22222222-2222-2222-2222-222222222222')).toBeNull();

    // Regular members have a Remove button
    expect(
      screen.getByTestId('remove-member-55555555-5555-5555-5555-555555555555'),
    ).toBeInTheDocument();
  });

  it('allows Admin to add a new member from directory', async () => {
    const updatedDetail: ProjectDetail = {
      ...mockProjectDetail,
      members: [
        ...mockProjectDetail.members,
        {
          employeeId: '77777777-7777-7777-7777-777777777777',
          name: 'James Bond',
          addedAt: '2026-02-01T12:00:00Z',
        },
      ],
    };

    vi.mocked(projectsApi.addProjectMember).mockResolvedValue(updatedDetail);

    render(
      <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-member-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-member-btn'));

    expect(screen.getByText('Add Project Member')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByTestId('select-employee-77777777-7777-7777-7777-777777777777'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-employee-77777777-7777-7777-7777-777777777777'));
    fireEvent.click(screen.getByTestId('confirm-add-member-btn'));

    await waitFor(() => {
      expect(projectsApi.addProjectMember).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        '77777777-7777-7777-7777-777777777777',
      );
    });
  });

  it('allows Admin to remove a non-owner member', async () => {
    const afterRemovalDetail: ProjectDetail = {
      ...mockProjectDetail,
      members: mockProjectDetail.members.filter(
        (m) => m.employeeId !== '55555555-5555-5555-5555-555555555555',
      ),
    };

    vi.mocked(projectsApi.removeProjectMember).mockResolvedValue(afterRemovalDetail);

    render(
      <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('remove-member-55555555-5555-5555-5555-555555555555'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('remove-member-55555555-5555-5555-5555-555555555555'));

    await waitFor(() => {
      expect(projectsApi.removeProjectMember).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555',
      );
    });
  });

  it('allows toggling project archive status with version token', async () => {
    const archivedDetail: ProjectDetail = {
      ...mockProjectDetail,
      status: 'archived',
      version: 2,
    };

    vi.mocked(projectsApi.updateProject).mockResolvedValue(archivedDetail);

    render(
      <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-archive-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-archive-btn'));

    await waitFor(() => {
      expect(projectsApi.updateProject).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        expect.objectContaining({
          status: 'archived',
          version: 1,
        }),
      );
    });
  });

  it('displays Staff overview KPIs, filters, and supports grid/list layout switching', async () => {
    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: mockProjects,
      meta: { page: 1, pageSize: 20, total: 2 },
      summary: {
        totalAssigned: 4,
        inProgress: 2,
        completed: 1,
        upcoming: 1,
        onHold: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={['/staff/projects']}>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <ProjectsListPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('projects-overview-cards')).toBeInTheDocument();
      expect(screen.getByText('Total Assigned Projects')).toBeInTheDocument();
      expect(screen.getByTestId('overview-count-total-assigned')).toHaveTextContent('4');
      expect(screen.getByTestId('overview-count-in-progress')).toHaveTextContent('2');
      expect(screen.getByTestId('overview-count-completed')).toHaveTextContent('1');
      expect(screen.getByTestId('overview-count-upcoming')).toHaveTextContent('1');
    });

    // Switch to List View and verify table renders
    fireEvent.click(screen.getByTestId('view-list-btn'));
    expect(screen.getByTestId('projects-list-view')).toBeInTheDocument();

    // Filter by priority triggers fetchProjects with priority filter
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } });
    await waitFor(() => {
      expect(projectsApi.fetchProjects).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' }),
        expect.any(AbortSignal),
      );
    });
  });

  it('lets Staff inspect milestones and post a progress update on ProjectDetailPage', async () => {
    const detailedWithWorkspace: ProjectDetail = {
      ...mockProjectDetail,
      priority: 'high',
      workflowStatus: 'in_progress',
      progressPercent: 60,
      objectives: 'Complete portal redesign.',
      scope: 'Frontend and API integration.',
      technologies: ['React 18', 'PostgreSQL 16'],
      milestones: [
        {
          id: 'm1',
          projectId: mockProjectDetail.id,
          title: 'Milestone 1: UI Kit',
          description: 'Deliver reusable cards.',
          startDate: '2026-01-01',
          dueDate: '2026-02-01',
          status: 'completed',
          completionPercent: 100,
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-15T00:00:00Z',
        },
      ],
      updates: [
        {
          id: 'u1',
          projectId: mockProjectDetail.id,
          authorEmployeeId: '22222222-2222-2222-2222-222222222222',
          authorName: 'Sarah Connor',
          updateType: 'manager_update',
          content: 'Great progress this sprint.',
          progressPercent: 60,
          createdAt: '2026-02-01T10:00:00Z',
        },
      ],
      documents: [],
    };

    vi.mocked(projectsApi.fetchProjectById).mockResolvedValue(detailedWithWorkspace);
    vi.mocked(projectsApi.createProjectUpdate).mockResolvedValue({
      id: 'u2',
      projectId: mockProjectDetail.id,
      authorEmployeeId: '44444444-4444-4444-4444-444444444444',
      authorName: 'Kyle Reese',
      updateType: 'progress_update',
      content: 'Finished milestone 2 integration.',
      progressPercent: 75,
      createdAt: '2026-02-02T10:00:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Complete portal redesign.')).toBeInTheDocument();
      expect(screen.getByText('React 18')).toBeInTheDocument();
    });

    // Switch to Milestones tab
    fireEvent.click(screen.getByRole('tab', { name: /Milestones/i }));
    expect(screen.getByText('Milestone 1: UI Kit')).toBeInTheDocument();

    // Switch to Updates & Activity tab
    fireEvent.click(screen.getByRole('tab', { name: /Updates & Activity/i }));
    expect(screen.getAllByText('Great progress this sprint.').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByLabelText(/Progress Details/i), {
      target: { value: 'Finished milestone 2 integration.' },
    });
    fireEvent.click(screen.getByTestId('submit-project-update-btn'));

    await waitFor(() => {
      expect(projectsApi.createProjectUpdate).toHaveBeenCalledWith(
        mockProjectDetail.id,
        expect.objectContaining({
          updateType: 'progress_update',
          content: 'Finished milestone 2 integration.',
        }),
      );
    });
  });
});
