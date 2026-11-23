// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TaskFormModal } from '../components/TaskFormModal';
import * as employeesApi from '../../employees/api/employees';
import * as profileApi from '../../profile/api/profileApi';
import * as projectsApi from '../../projects/api/projectsApi';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { EmployeeProfile } from '../../profile/types';

vi.mock('../../employees/api/employees', () => ({
  fetchEmployeeDirectory: vi.fn(),
}));

vi.mock('../../profile/api/profileApi', () => ({
  fetchProfile: vi.fn(),
}));

vi.mock('../../projects/api/projectsApi', () => ({
  fetchProjects: vi.fn(),
}));

const mockUser = {
  id: 'usr-001',
  employeeId: 'emp-uuid-arun',
  email: 'arunkumar@maxr.internal',
  name: 'Arun Kumar',
};

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'staff',
    isAuthenticated: true,
  }),
}));

const mockEmployees: EmployeeDirectoryItem[] = [
  {
    id: 'emp-uuid-arun',
    employeeCode: 'EMP-0001',
    firstName: 'Arun',
    lastName: 'Kumar',
    email: 'arunkumar@maxr.internal',
    phone: null,
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'Software Engineer' },
    manager: null,
    status: 'active',
    joiningDate: '2025-01-01',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'emp-uuid-shajitha',
    employeeCode: 'EMP-0002',
    firstName: 'Shajitha',
    lastName: 'Banu',
    email: 'shajitha@maxr.internal',
    phone: null,
    department: { id: 'dept-2', name: 'HR', code: 'HR' },
    designation: { id: 'desig-2', title: 'HR Manager' },
    manager: null,
    status: 'active',
    joiningDate: '2025-01-01',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const mockProfile: EmployeeProfile = {
  id: 'emp-uuid-arun',
  employeeCode: 'EMP-0001',
  firstName: 'Arun',
  lastName: 'Kumar',
  email: 'arunkumar@maxr.internal',
  phone: null,
  department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-1', title: 'Software Engineer' },
  manager: null,
  status: 'active',
  joiningDate: '2025-01-01',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  version: 1,
};

describe('TaskFormModal - Staff Portal (No Assignee Field)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeesApi.fetchEmployeeDirectory).mockResolvedValue({
      data: mockEmployees,
      meta: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(profileApi.fetchProfile).mockResolvedValue(mockProfile);
    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders staff task creation without Assignee dropdown and without Assign to Me checkbox', async () => {
    render(<TaskFormModal isOpen={true} onClose={vi.fn()} mode="create" isStaff={true} />);

    await waitFor(() => {
      expect(profileApi.fetchProfile).toHaveBeenCalled();
    });

    // Assignee dropdown and Assign to Me checkbox are NOT present
    expect(screen.queryByTestId('task-assignee-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkbox-assign-to-me')).not.toBeInTheDocument();

    // Priority, Project, and Due Date fields ARE present
    expect(screen.getByTestId('task-priority-select')).toBeInTheDocument();
    expect(screen.getByTestId('task-project-select')).toBeInTheDocument();
    expect(screen.getByTestId('task-due-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-task-daily')).toBeInTheDocument();
  });

  it('automatically assigns task to authenticated staff member without requiring assignee selection', async () => {
    const onSubmitCreate = vi.fn().mockResolvedValue({ id: 'staff-task-1' });
    render(
      <TaskFormModal
        isOpen={true}
        onClose={vi.fn()}
        mode="create"
        isStaff={true}
        onSubmitCreate={onSubmitCreate}
      />,
    );

    await waitFor(() => {
      expect(profileApi.fetchProfile).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('task-title-input'), {
      target: { value: 'Staff created task' },
    });

    fireEvent.click(screen.getByTestId('submit-task-btn'));

    await waitFor(() => {
      expect(onSubmitCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Staff created task',
          assigneeEmployeeId: 'emp-uuid-arun',
        }),
      );
    });
  });
});

describe('TaskFormModal - Admin / Lead Portal (With Assignee Field & Assign to Me Checkbox)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeesApi.fetchEmployeeDirectory).mockResolvedValue({
      data: mockEmployees,
      meta: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(profileApi.fetchProfile).mockResolvedValue(mockProfile);
    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders modal with "Assign to Me" unchecked by default and Assignee dropdown empty and enabled', async () => {
    render(<TaskFormModal isOpen={true} onClose={vi.fn()} mode="create" isStaff={false} />);

    await waitFor(() => {
      expect(employeesApi.fetchEmployeeDirectory).toHaveBeenCalled();
    });

    const checkbox = screen.getByTestId('checkbox-assign-to-me') as HTMLInputElement;
    expect(checkbox).not.toBeChecked();

    const assigneeSelect = screen.getByTestId('task-assignee-select') as HTMLSelectElement;
    expect(assigneeSelect).not.toBeDisabled();
    expect(assigneeSelect.value).toBe('');
  });

  it('automatically selects the logged-in user and disables the dropdown when checked', async () => {
    render(<TaskFormModal isOpen={true} onClose={vi.fn()} mode="create" isStaff={false} />);

    await waitFor(() => {
      expect(employeesApi.fetchEmployeeDirectory).toHaveBeenCalled();
    });

    const checkbox = screen.getByTestId('checkbox-assign-to-me') as HTMLInputElement;
    const assigneeSelect = screen.getByTestId('task-assignee-select') as HTMLSelectElement;

    // Check "Assign to Me"
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(assigneeSelect).toBeDisabled();
    expect(assigneeSelect.value).toBe('emp-uuid-arun');

    // Displays name and employee code
    const selectedOption = assigneeSelect.querySelector('option:checked');
    expect(selectedOption?.textContent).toContain('Arun Kumar (EMP-0001)');
  });

  it('clears assignee and re-enables dropdown when "Assign to Me" is unchecked after being checked', async () => {
    render(<TaskFormModal isOpen={true} onClose={vi.fn()} mode="create" isStaff={false} />);

    await waitFor(() => {
      expect(employeesApi.fetchEmployeeDirectory).toHaveBeenCalled();
    });

    const checkbox = screen.getByTestId('checkbox-assign-to-me') as HTMLInputElement;
    const assigneeSelect = screen.getByTestId('task-assignee-select') as HTMLSelectElement;

    // Check
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(assigneeSelect.value).toBe('emp-uuid-arun');
    expect(assigneeSelect).toBeDisabled();

    // Uncheck
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(assigneeSelect).not.toBeDisabled();
    expect(assigneeSelect.value).toBe('');
  });

  it('validates mandatory Assignee when unchecked and not selected in Admin mode', async () => {
    const onSubmitCreate = vi.fn();
    render(
      <TaskFormModal
        isOpen={true}
        onClose={vi.fn()}
        mode="create"
        isStaff={false}
        onSubmitCreate={onSubmitCreate}
      />,
    );

    await waitFor(() => {
      expect(employeesApi.fetchEmployeeDirectory).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('task-title-input'), {
      target: { value: 'New Test Task' },
    });

    fireEvent.click(screen.getByTestId('submit-task-btn'));

    expect(screen.getByText('Please select an assignee')).toBeInTheDocument();
    expect(onSubmitCreate).not.toHaveBeenCalled();
  });

  it('allows manual selection of another employee in Admin mode', async () => {
    const onSubmitCreate = vi.fn().mockResolvedValue({ id: 'task-new-1' });
    render(
      <TaskFormModal
        isOpen={true}
        onClose={vi.fn()}
        mode="create"
        isStaff={false}
        onSubmitCreate={onSubmitCreate}
      />,
    );

    await waitFor(() => {
      expect(employeesApi.fetchEmployeeDirectory).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('task-title-input'), {
      target: { value: 'Task for Shajitha' },
    });

    const assigneeSelect = screen.getByTestId('task-assignee-select') as HTMLSelectElement;
    fireEvent.change(assigneeSelect, { target: { value: 'emp-uuid-shajitha' } });
    expect(assigneeSelect.value).toBe('emp-uuid-shajitha');

    fireEvent.click(screen.getByTestId('submit-task-btn'));

    await waitFor(() => {
      expect(onSubmitCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task for Shajitha',
          assigneeEmployeeId: 'emp-uuid-shajitha',
        }),
      );
    });
  });
});
