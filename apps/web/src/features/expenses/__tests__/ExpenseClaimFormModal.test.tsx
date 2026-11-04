// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/expensesApi';
import { ExpenseClaimFormModal } from '../components/ExpenseClaimFormModal';
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
  {
    id: '50000000-0000-4000-a000-000000000002',
    name: 'Meals',
    description: 'Food & drinks',
    isActive: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

describe('ExpenseClaimFormModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders modal with category options and fields', () => {
    render(
      <ExpenseClaimFormModal
        isOpen={true}
        onClose={vi.fn()}
        categories={mockCategories}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Submit Expense Claim')).toBeInTheDocument();
    expect(screen.getByLabelText(/Expense Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expense Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it('shows receipt required message when amount > ₹200.00', () => {
    render(
      <ExpenseClaimFormModal
        isOpen={true}
        onClose={vi.fn()}
        categories={mockCategories}
        onSuccess={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '250.00' } });

    expect(screen.getByText(/Receipt \(Required\)/i)).toBeInTheDocument();
  });

  it('allows submission for <= ₹200.00 without receipt', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    const mockCreatedClaim: ExpenseClaim = {
      id: 'c-1',
      employeeId: 'emp-1',
      categoryId: mockCategories[0]!.id,
      amountPaise: 15000,
      currency: 'INR',
      expenseDate: '2026-11-01',
      description: 'Auto fare',
      receiptStorageKey: null,
      receiptFilename: null,
      receiptMimeType: null,
      receiptFileSize: null,
      status: 'submitted',
      rejectionReason: null,
      reimbursedAt: null,
      reimbursedByEmployeeId: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    };

    const submitSpy = vi.spyOn(api, 'submitClaim').mockResolvedValueOnce(mockCreatedClaim);

    render(
      <ExpenseClaimFormModal
        isOpen={true}
        onClose={onClose}
        categories={mockCategories}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '150.00' } });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Auto fare for meeting' },
    });

    const submitBtn = screen.getByRole('button', { name: /Submit Claim/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: mockCategories[0]!.id,
          amountPaise: 15000,
          description: 'Auto fare for meeting',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith(mockCreatedClaim);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
