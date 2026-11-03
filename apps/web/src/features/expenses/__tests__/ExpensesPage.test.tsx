// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { ROLES } from '@maxr/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authContext from '../../../auth/AuthContext';
import * as api from '../api/expensesApi';
import { ExpensesPage } from '../pages/ExpensesPage';
import type { ExpenseCategory, ExpenseClaim } from '../types';

const mockCategories: ExpenseCategory[] = [
  {
    id: '50000000-0000-4000-a000-000000000001',
    name: 'Travel',
    description: 'Travel expenses',
    isActive: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

const mockClaims: ExpenseClaim[] = [
  {
    id: 'claim-1',
    employeeId: 'emp-1',
    employeeName: 'Sam Staff',
    employeeCode: 'EMP001',
    categoryId: '50000000-0000-4000-a000-000000000001',
    categoryName: 'Travel',
    amountPaise: 45000,
    currency: 'INR',
    expenseDate: '2026-11-01',
    description: 'Client visit cab fare',
    receiptStorageKey: 'receipts/test.pdf',
    receiptFilename: 'receipt.pdf',
    receiptMimeType: 'application/pdf',
    receiptFileSize: 25000,
    status: 'submitted',
    rejectionReason: null,
    reimbursedAt: null,
    reimbursedByEmployeeId: null,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  },
];

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-1',
        email: 'staff@example.com',
        role: ROLES.STAFF,
        roles: [ROLES.STAFF],
        employeeId: 'emp-1',
        name: 'Sam Staff',
        permissions: [],
        avatarInitials: 'SS',
      },
      role: ROLES.STAFF,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });

    vi.spyOn(api, 'listCategories').mockResolvedValue(mockCategories);
    vi.spyOn(api, 'listMyClaims').mockResolvedValue({
      data: mockClaims,
      meta: { page: 1, pageSize: 15, total: 1, pageCount: 1 },
    });
    vi.spyOn(api, 'listClaims').mockResolvedValue({
      data: mockClaims,
      meta: { page: 1, pageSize: 15, total: 1, pageCount: 1 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders page header and metric strip', async () => {
    render(<ExpensesPage />);

    expect(screen.getByText('Expenses & Claims')).toBeInTheDocument();
    expect(screen.getByText(/Submit business expense claims with receipts/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-claim-button')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Client visit cab fare').length).toBeGreaterThan(0);
      expect(screen.getAllByText('₹450.00').length).toBeGreaterThan(0);
    });
  });

  it('opens submit modal when + Submit Claim is clicked', async () => {
    render(<ExpensesPage />);

    const submitBtn = screen.getByTestId('submit-claim-button');
    fireEvent.click(submitBtn);

    expect(screen.getByRole('heading', { name: 'Submit Expense Claim' })).toBeInTheDocument();
  });

  it('opens detail drawer when View is clicked', async () => {
    render(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Client visit cab fare').length).toBeGreaterThan(0);
    });

    const viewButtons = screen.getAllByRole('button', {
      name: /View claim for Client visit cab fare/i,
    });
    expect(viewButtons[0]).toBeDefined();
    fireEvent.click(viewButtons[0]!);

    expect(screen.getByText('Expense Claim Details')).toBeInTheDocument();
    expect(screen.getByText('Business Purpose & Notes')).toBeInTheDocument();
  });

  it('renders role tabs for Team Lead to switch between My Claims and Team Claims', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-lead',
        email: 'lead@example.com',
        role: ROLES.TEAM_LEAD,
        roles: [ROLES.TEAM_LEAD],
        employeeId: 'emp-lead',
        name: 'Tara Lead',
        permissions: [],
        avatarInitials: 'TL',
      },
      role: ROLES.TEAM_LEAD,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });

    render(<ExpensesPage />);

    expect(screen.getByRole('tab', { name: /My Claims/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Team Claims/i })).toBeInTheDocument();
  });
});
