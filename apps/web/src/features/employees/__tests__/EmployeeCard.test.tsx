// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeCard } from '../components/EmployeeCard';
import type { EmployeeDirectoryItem } from '../types';

const mockEmployee: EmployeeDirectoryItem = {
  id: 'emp-101',
  employeeCode: 'MAX-0101',
  firstName: 'Priya',
  lastName: 'Sharma',
  email: 'priya.sharma@example.com',
  phone: '+91 98765 43210',
  department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-swe', title: 'Senior Software Engineer', code: 'SWE', level: 3 },
  manager: {
    id: 'emp-mgr',
    firstName: 'Kavita',
    lastName: 'Iyer',
    employeeCode: 'MGR-001',
  },
  status: 'active',
  joiningDate: '2024-03-01',
  createdAt: '2024-03-01T00:00:00Z',
  updatedAt: '2024-03-01T00:00:00Z',
};

describe('EmployeeCard Component Navigation & Actions (Issue #155)', () => {
  it('renders employee name as a link to detail page (/employees/:id)', () => {
    render(
      <MemoryRouter>
        <EmployeeCard employee={mockEmployee} />
      </MemoryRouter>,
    );

    const nameLink = screen.getByTestId('employee-card-name-link-emp-101');
    expect(nameLink).toBeInTheDocument();
    expect(nameLink).toHaveAttribute('href', '/employees/emp-101');
    expect(nameLink).toHaveTextContent('Priya Sharma');
  });

  it('renders View Details action button linking to /employees/:id', () => {
    render(
      <MemoryRouter>
        <EmployeeCard employee={mockEmployee} />
      </MemoryRouter>,
    );

    const viewDetailsLink = screen.getByTestId('view-details-card-emp-101');
    expect(viewDetailsLink).toBeInTheDocument();
    expect(viewDetailsLink).toHaveAttribute('href', '/employees/emp-101');
    expect(viewDetailsLink).toHaveTextContent('View Details');
  });

  it('renders email and call actions with proper href attributes', () => {
    render(
      <MemoryRouter>
        <EmployeeCard employee={mockEmployee} />
      </MemoryRouter>,
    );

    const emailLink = screen.getByRole('link', { name: /send email to priya sharma/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:priya.sharma@example.com');

    const callLink = screen.getByRole('link', { name: /call priya sharma/i });
    expect(callLink).toHaveAttribute('href', 'tel:+91 98765 43210');
  });

  it('keeps deactivation button independent and triggers onDeactivate callback', () => {
    const handleDeactivate = vi.fn();
    render(
      <MemoryRouter>
        <EmployeeCard
          employee={mockEmployee}
          canDeactivate={true}
          onDeactivate={handleDeactivate}
        />
      </MemoryRouter>,
    );

    const deactivateBtn = screen.getByTestId('deactivate-btn-card-emp-101');
    expect(deactivateBtn).toBeInTheDocument();

    fireEvent.click(deactivateBtn);
    expect(handleDeactivate).toHaveBeenCalledTimes(1);
    expect(handleDeactivate).toHaveBeenCalledWith(mockEmployee);
  });

  it('hides deactivation button when canDeactivate is false', () => {
    render(
      <MemoryRouter>
        <EmployeeCard employee={mockEmployee} canDeactivate={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('deactivate-btn-card-emp-101')).not.toBeInTheDocument();
  });

  it('renders safely outside of Router context using SafeLink fallback', () => {
    render(<EmployeeCard employee={mockEmployee} />);

    const nameLink = screen.getByTestId('employee-card-name-link-emp-101');
    expect(nameLink).toBeInTheDocument();
    expect(nameLink.tagName).toBe('A');
    expect(nameLink).toHaveAttribute('href', '/employees/emp-101');
  });
});
