// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileHeader } from '../components/ProfileHeader';
import type { EmployeeProfile } from '../types';

const mockProfile: EmployeeProfile = {
  id: 'emp-001',
  employeeCode: 'EMP-001',
  firstName: 'Priya',
  lastName: 'Sharma',
  email: 'priya.sharma@example.com',
  phone: '+91 98765 00000',
  department: { id: 'dept-1', name: 'Product', code: 'PROD' },
  designation: { id: 'desig-1', title: 'Product Specialist', code: 'PROD-SP' },
  manager: {
    id: 'mgr-001',
    firstName: 'Kavita',
    lastName: 'Iyer',
    employeeCode: 'MGR-001',
  },
  status: 'active',
  joiningDate: '2025-06-01',
  createdAt: '2025-06-01T00:00:00.000Z',
  updatedAt: '2025-06-01T00:00:00.000Z',
  version: 1,
};

describe('ProfileHeader Component Navigation (Issue #155)', () => {
  it('renders View Full Employee Record link when profile has a valid ID', () => {
    render(
      <MemoryRouter>
        <ProfileHeader profile={mockProfile} />
      </MemoryRouter>,
    );

    const recordLink = screen.getByTestId('view-full-record-link');
    expect(recordLink).toBeInTheDocument();
    expect(recordLink).toHaveAttribute('href', '/employees/emp-001');
    expect(recordLink).toHaveTextContent(/View Full Employee Record/i);
  });

  it('handles missing or empty employee ID safely without rendering the link', () => {
    const profileWithoutId: EmployeeProfile = {
      ...mockProfile,
      id: '',
    };

    render(
      <MemoryRouter>
        <ProfileHeader profile={profileWithoutId} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('view-full-record-link')).not.toBeInTheDocument();
  });

  it('preserves existing profile header status and identity information', () => {
    render(
      <MemoryRouter>
        <ProfileHeader profile={mockProfile} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Priya Sharma');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('EMP-001')).toBeInTheDocument();
    expect(screen.getByText(/Product Specialist/i)).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('renders safely outside Router context using SafeLink fallback', () => {
    render(<ProfileHeader profile={mockProfile} />);

    const recordLink = screen.getByTestId('view-full-record-link');
    expect(recordLink).toBeInTheDocument();
    expect(recordLink.tagName).toBe('A');
    expect(recordLink).toHaveAttribute('href', '/employees/emp-001');
  });
});
