// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsApiClient } from '../../api/approvalsApi';
import { Approval } from '../../types/approvals';
import { ApprovalsInbox } from '../ApprovalsInbox';

describe('TC-37: ApprovalsInbox Component Unit Tests', () => {
  afterEach(() => {
    cleanup();
  });
  const mockApprovals: Approval[] = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      subjectType: 'LEAVE',
      subjectId: 's1000000-0000-0000-0000-000000000001',
      requesterId: 'r1000000-0000-0000-0000-000000000001',
      approverId: null,
      status: 'PENDING',
      comment: null,
      decidedAt: null,
      createdAt: '2026-10-29T10:00:00Z',
      updatedAt: '2026-10-29T10:00:00Z',
    },
  ];

  function createMockApi(): ApprovalsApiClient {
    return {
      list: vi.fn().mockResolvedValue({
        data: [...mockApprovals],
        meta: { total: 1, page: 1, pageSize: 10 },
      }),
      getById: vi.fn().mockImplementation((id: string) => {
        const found = mockApprovals.find((a) => a.id === id);
        return Promise.resolve(found || mockApprovals[0]);
      }),
      approve: vi.fn().mockImplementation((id: string, req?: { comment?: string }) => {
        return Promise.resolve({
          ...mockApprovals[0],
          id,
          status: 'APPROVED',
          comment: req?.comment || 'Approved',
          decidedAt: '2026-10-29T10:30:00Z',
        });
      }),
      reject: vi.fn().mockImplementation((id: string, req?: { comment?: string }) => {
        return Promise.resolve({
          ...mockApprovals[0],
          id,
          status: 'REJECTED',
          comment: req?.comment || 'Rejected',
          decidedAt: '2026-10-29T10:30:00Z',
        });
      }),
    };
  }

  it('renders pending approvals list successfully', async () => {
    const api = createMockApi();
    render(<ApprovalsInbox api={api} />);

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(
      () => {
        expect(screen.getAllByText('Leave Request').length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('opens approval modal and completes approval action', async () => {
    const api = createMockApi();
    const onDecision = vi.fn();
    render(<ApprovalsInbox api={api} onDecisionComplete={onDecision} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^approve$/i }).length).toBeGreaterThan(0);
    });

    const approveButtons = screen.getAllByRole('button', { name: /^approve$/i });
    fireEvent.click(approveButtons[0]!);

    // Modal dialog is shown
    expect(screen.getByText('Approve Request')).toBeDefined();

    const commentInput = screen.getByLabelText(/reason \/ comment/i);
    fireEvent.change(commentInput, { target: { value: 'Approved by lead' } });

    const confirmButton = screen.getByRole('button', { name: /confirm approval/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.approve).toHaveBeenCalled();
    });

    expect(onDecision).toHaveBeenCalled();
  });

  it('opens rejection modal and completes rejection action', async () => {
    const api = createMockApi();
    const onDecision = vi.fn();
    render(<ApprovalsInbox api={api} onDecisionComplete={onDecision} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^reject$/i }).length).toBeGreaterThan(0);
    });

    const rejectButtons = screen.getAllByRole('button', { name: /^reject$/i });
    fireEvent.click(rejectButtons[0]!);

    expect(screen.getByText('Reject Request')).toBeDefined();

    const commentInput = screen.getByLabelText(/reason \/ comment/i);
    fireEvent.change(commentInput, { target: { value: 'Not eligible' } });

    const confirmButton = screen.getByRole('button', { name: /confirm rejection/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.reject).toHaveBeenCalled();
    });

    expect(onDecision).toHaveBeenCalled();
  });

  it('renders empty state when there are no approval requests', async () => {
    const api = createMockApi();
    (api.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10 },
    });

    render(<ApprovalsInbox api={api} />);

    await waitFor(
      () => {
        expect(screen.getByText('No approval requests found')).toBeDefined();
      },
      { timeout: 5000 },
    );
  });
});
