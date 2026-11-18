// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExpensesPage } from '../pages/ExpensesPage';

describe('ExpensesPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Coming Soon state for the expenses section', () => {
    render(<ExpensesPage />);

    expect(screen.getByTestId('expenses-coming-soon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming Soon...' })).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });
});
