// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '@maxr/shared';
import { ExpensesPage } from '../pages/ExpensesPage';

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'test@maxr.com', name: 'Test User' },
    role: ROLES.ADMIN,
    session: null,
    loading: false,
  }),
}));

vi.mock('../api/expensesApi', () => ({
  listCategories: vi.fn().mockResolvedValue({ data: [] }),
  listClaims: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0 } }),
  listMyClaims: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0 } }),
}));

describe('ExpensesPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the expenses page header and submit button', () => {
    render(<ExpensesPage />);

    expect(screen.getByTestId('expenses-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Expenses & Claims' })).toBeInTheDocument();
    expect(screen.getByTestId('submit-claim-button')).toBeInTheDocument();
  });
});
