// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../auth/AuthContext';
import * as employeesApi from '../api/employees';
import * as onboardingApi from '../api/onboarding';
import { OnboardingPage } from '../pages/OnboardingPage';

describe('OnboardingPage Hiring & Onboarding Workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(employeesApi, 'fetchDepartments').mockResolvedValue([
      { id: 'dept-1', name: 'Engineering', code: 'ENG' },
      { id: 'dept-2', name: 'Human Resources', code: 'HR' },
    ]);
    vi.spyOn(employeesApi, 'fetchDesignations').mockResolvedValue([
      { id: 'desig-1', title: 'Software Engineer', code: 'SWE', level: 2 },
    ]);
    vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 50, totalPages: 0 },
    });
    vi.spyOn(onboardingApi, 'fetchOnboardingList').mockResolvedValue({
      data: [
        {
          id: 'chk-1',
          employeeId: 'emp-1',
          employeeCode: 'EMP-009',
          firstName: 'Asha',
          lastName: 'Rao',
          email: 'asha@example.com',
          departmentId: 'dept-1',
          departmentName: 'Engineering',
          designationId: 'desig-1',
          designationTitle: 'Software Engineer',
          managerId: null,
          joiningDate: '2026-11-12',
          employeeStatus: 'pending',
          userActive: false,
          status: 'in_progress',
          currentStep: 'hr',
          completedAt: null,
          createdAt: '2026-11-10T10:00:00Z',
          updatedAt: '2026-11-10T10:00:00Z',
          totalItems: 14,
          verifiedItems: 3,
        },
      ],
      total: 1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <OnboardingPage />
        </AuthProvider>
      </MemoryRouter>,
    );

  it('renders Hiring and Onboarding tabs and displays 5 drag-and-drop columns on Hiring tab', async () => {
    renderPage();

    expect(await screen.findByTestId('hiring-pipeline-board')).toBeInTheDocument();
    expect(screen.getByTestId('tab-hiring')).toHaveTextContent('Hiring');
    expect(screen.getByTestId('tab-onboarding')).toHaveTextContent('Onboarding');
    expect(screen.getByTestId('hiring-column-applied')).toBeInTheDocument();
    expect(screen.getByTestId('hiring-column-phone_screen')).toBeInTheDocument();
    expect(screen.getByTestId('hiring-column-interview')).toBeInTheDocument();
    expect(screen.getByTestId('hiring-column-offer')).toBeInTheDocument();
    expect(screen.getByTestId('hiring-column-hired')).toBeInTheDocument();
  });

  it('supports drag-and-drop movement of candidate cards across columns', async () => {
    renderPage();

    const card = await screen.findByTestId('candidate-card-cand-1');
    const interviewColumn = screen.getByTestId('hiring-column-interview');

    const transferData: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: (type: string, val: string) => {
        transferData[type] = val;
      },
      getData: (type: string) => transferData[type] ?? '',
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(interviewColumn, { dataTransfer });
    fireEvent.drop(interviewColumn, { dataTransfer });

    await waitFor(() => {
      expect(screen.getByText(/Moved Karthik Subramanian to Interview/i)).toBeInTheDocument();
    });
  });

  it('switches to Onboarding tab, opens role drawer, and displays CRM employee checklists', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('tab-onboarding'));

    expect(await screen.findByTestId('onboarding-workspace-tab')).toBeInTheDocument();
    expect(screen.getByTestId('role-opening-card-role-swe')).toBeInTheDocument();
    expect(screen.getByTestId('employee-onboarding-card-emp-1')).toBeInTheDocument();

    // Open role drawer
    fireEvent.click(screen.getByTestId('open-role-btn-role-swe'));
    expect(await screen.findByTestId('role-opening-drawer')).toBeInTheDocument();
    expect(screen.getByText('REQ-104 · Engineering')).toBeInTheDocument();
  });

  it('adds a new candidate via + Add candidate modal', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('add-candidate-button'));
    expect(await screen.findByTestId('add-candidate-form')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. Ananya'), { target: { value: 'Nithya' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Krishnan'), { target: { value: 'Ramesh' } });
    fireEvent.change(screen.getByPlaceholderText('candidate@example.com'), {
      target: { value: 'nithya.ramesh@example.com' },
    });

    fireEvent.click(screen.getByTestId('submit-candidate-btn'));

    await waitFor(() => {
      expect(screen.getByText('Nithya Ramesh')).toBeInTheDocument();
    });
  });
});
