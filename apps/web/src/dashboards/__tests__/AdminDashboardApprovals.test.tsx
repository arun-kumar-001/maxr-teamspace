// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '../AdminDashboard';
import { APPROVED_IDS_STORAGE_KEY } from '../../features/approvals/approval-permissions';

describe('AdminDashboard Pending Approvals (Issue #3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('approving an item marks it approved, decrements count, and removes it from pending list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/approvals')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'app-item-1',
                    subjectType: 'leave_request',
                    requesterName: 'Jane Doe',
                    status: 'pending',
                    stages: ['admin'],
                    currentStage: 0,
                    decisions: [],
                  },
                ],
                meta: { total: 1, page: 1, pageSize: 3 },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: [] }),
        });
      }),
    );

    render(<AdminDashboard />);

    // Wait for the pending approval to load
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeDefined();
    });

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDefined();

    // Click Approve
    act(() => {
      fireEvent.click(approveButton);
    });

    // Button should immediately show Approved
    expect(screen.getByText('Approved')).toBeDefined();

    // ID should be recorded in localStorage
    const saved = localStorage.getItem(APPROVED_IDS_STORAGE_KEY);
    expect(saved).toContain('app-item-1');

    // After the transition timeout, the item is removed from the pending list
    await waitFor(
      () => {
        expect(screen.getByText('No pending approvals')).toBeDefined();
      },
      { timeout: 1500 },
    );
  });

  it('filters out previously approved items on initial load so they never reappear', async () => {
    localStorage.setItem(APPROVED_IDS_STORAGE_KEY, JSON.stringify(['app-item-1']));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/approvals')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'app-item-1',
                    subjectType: 'leave_request',
                    requesterName: 'Jane Doe',
                    status: 'pending',
                    stages: ['admin'],
                    currentStage: 0,
                    decisions: [],
                  },
                ],
                meta: { total: 1, page: 1, pageSize: 3 },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: [] }),
        });
      }),
    );

    render(<AdminDashboard />);

    // Because app-item-1 was already approved, it should NOT appear in pending approvals
    await waitFor(() => {
      expect(screen.getByText('No pending approvals')).toBeDefined();
    });
  });
});
