// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@maxr/shared';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import * as auditLogsApi from '../api/auditLogsApi';
import * as authContext from '../../../auth/AuthContext';
import type { AuditLogItem, AuditLogListResponse } from '../types';

afterEach(cleanup);

describe('AuditLogsPage Component Suite (Issue #28)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockLogs: AuditLogItem[] = [
    {
      id: 'log-1',
      occurredAt: '2026-11-01T10:00:00Z',
      action: 'leave.approve',
      outcome: 'success',
      actor: { id: 'u-1', name: 'Eleanor Vance', role: 'admin' },
      entityType: 'leave_request',
      entityId: 'req-1',
      requestId: 'req-uuid-1',
      changes: { status: 'approved' },
      metadata: { ip: '127.0.0.1' },
    },
    {
      id: 'log-2',
      occurredAt: '2026-11-01T11:00:00Z',
      action: 'auth.login',
      outcome: 'denied',
      actor: { id: 'u-2', name: 'John Doe', role: 'staff' },
      entityType: 'user',
      entityId: 'u-2',
      requestId: 'req-uuid-2',
      changes: null,
      metadata: { reason: 'invalid_password' },
    },
  ];

  const mockResponse: AuditLogListResponse = {
    data: mockLogs,
    meta: {
      page: 1,
      pageSize: 50,
      total: 2,
    },
  };

  function setupAuth(role: Role = 'admin') {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      role,
      user: {
        id: 'u-1',
        employeeId: 'emp-1',
        name: 'Eleanor Vance',
        email: 'eleanor@maxr.internal',
        role,
        roles: [role],
        permissions: ['audit_logs.list'],
        avatarInitials: 'EV',
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });
  }

  it('renders page header, stat cards, and log table for Admin', async () => {
    setupAuth('admin');
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);
    vi.spyOn(auditLogsApi, 'getBasicSettings').mockResolvedValue({
      companyName: 'MAXR Global',
      timezone: 'UTC',
    });

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText(/Immutable append-only record/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('leave.approve').length).toBeGreaterThan(0);
      expect(screen.getAllByText('auth.login').length).toBeGreaterThan(0);
    });

    expect(screen.getByTestId('audit-log-filters')).toBeInTheDocument();
  });

  it('renders ForbiddenState for unauthorized roles (HR Manager, Team Lead, Staff)', async () => {
    setupAuth('hr_manager');

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText(/Only Administrators can inspect system audit logs/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('audit-log-filters')).not.toBeInTheDocument();
  });

  it('opens detail modal when clicking View Details', async () => {
    setupAuth('admin');
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);
    vi.spyOn(auditLogsApi, 'getBasicSettings').mockResolvedValue({
      companyName: 'MAXR Global',
      timezone: 'UTC',
    });

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('row-details-log-1').length).toBeGreaterThan(0);
    });

    const detailBtn = screen.getAllByTestId('row-details-log-1')[0];
    expect(detailBtn).toBeDefined();
    fireEvent.click(detailBtn!);

    await waitFor(() => {
      expect(screen.getByTestId('audit-log-detail-modal')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit Trail Entry')).toBeInTheDocument();
    expect(screen.getByText(/"status": "approved"/)).toBeInTheDocument();
  });

  it('renders EmptyState when log list is empty', async () => {
    setupAuth('admin');
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
    vi.spyOn(auditLogsApi, 'getBasicSettings').mockResolvedValue(null);

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Audit Records Found')).toBeInTheDocument();
    });
  });

  it('renders ErrorState when API returns an error', async () => {
    setupAuth('admin');
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockRejectedValue(
      new auditLogsApi.AuditLogsApiError('Server unavailable', 500),
    );
    vi.spyOn(auditLogsApi, 'getBasicSettings').mockResolvedValue(null);

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });
});
