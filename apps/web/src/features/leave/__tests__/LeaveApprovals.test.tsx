// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LeaveApprovalsTab } from '../components/LeaveApprovalsTab';
import * as approvalsApi from '../../approvals/api/approvals';
import * as leaveApi from '../api/leave';
import type { Approval } from '../../approvals/types';
import type { LeaveRequest } from '../types';

// Mock AuthContext
const mockAuthUser = {
  id: 'usr-001',
  employeeId: 'emp-lead',
  email: 'lead@maxr.local',
  name: 'Lead User',
  role: 'team_lead',
  roles: ['team_lead'],
  permissions: ['approvals.list', 'approvals.decide', 'leave.list'],
  avatarInitials: 'LU',
};

let currentAuthRole: string = 'team_lead';
let currentAuthEmployeeId: string = 'emp-lead';

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      ...mockAuthUser,
      role: currentAuthRole,
      roles: [currentAuthRole],
      employeeId: currentAuthEmployeeId,
    },
    role: currentAuthRole,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    switchRole: vi.fn(),
  }),
}));

vi.mock('../../approvals/api/approvals');
vi.mock('../api/leave');

const mockApprovals: Approval[] = [
  {
    id: 'app-001',
    subjectType: 'leave_request',
    subjectId: 'req-001',
    requesterEmployeeId: 'emp-staff-1',
    requesterName: 'Alice Staff',
    stages: ['manager', 'hr'],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: '2026-11-01T08:00:00Z',
    decidedAt: null,
  },
  {
    id: 'app-002',
    subjectType: 'leave_request',
    subjectId: 'req-002',
    requesterEmployeeId: 'emp-lead', // Lead's own request (for self-approval test)
    requesterName: 'Lead User',
    stages: ['hr'],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: '2026-11-01T09:00:00Z',
    decidedAt: null,
  },
  {
    id: 'app-003',
    subjectType: 'leave_request',
    subjectId: 'req-003',
    requesterEmployeeId: 'emp-staff-2',
    requesterName: 'Bob Staff',
    stages: ['manager'],
    currentStage: 0,
    status: 'approved',
    decisions: [
      {
        stage: 0,
        decidedByEmployeeId: 'emp-lead',
        outcome: 'approved',
        comment: 'Enjoy your vacation',
        decidedAt: '2026-11-01T10:00:00Z',
      },
    ],
    createdAt: '2026-10-30T08:00:00Z',
    decidedAt: '2026-11-01T10:00:00Z',
  },
];

const mockLeaveRequest: LeaveRequest = {
  id: 'req-001',
  employeeId: 'emp-staff-1',
  employeeName: 'Alice Staff',
  leaveTypeId: 'pol-pto',
  leaveTypeCode: 'PTO',
  leaveTypeName: 'Paid Time Off',
  startDate: '2026-11-16',
  endDate: '2026-11-20',
  halfDay: false,
  days: 5,
  reason: 'Family vacation trip',
  status: 'pending',
  approvalId: 'app-001',
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
};

describe('Leave Approvals & Atomic Updates Suite (Issue #40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuthRole = 'team_lead';
    currentAuthEmployeeId = 'emp-lead';
    vi.mocked(approvalsApi.fetchApprovals).mockResolvedValue({
      data: mockApprovals,
      meta: { page: 1, pageSize: 50, total: 3 },
    });
    vi.mocked(leaveApi.fetchLeaveRequest).mockResolvedValue(mockLeaveRequest);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders leave approvals tab, shows pending count and approval table', async () => {
    render(<LeaveApprovalsTab />);

    await waitFor(() => {
      expect(screen.getByText('Team Leave Approvals')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Alice Staff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Staff').length).toBeGreaterThan(0);
    expect(screen.getByText('2 Pending')).toBeInTheDocument();
  });

  it('enforces no self-approval: displays forbidden indicator for own request and hides decision buttons', async () => {
    render(<LeaveApprovalsTab />);

    await waitFor(() => {
      expect(screen.getAllByText('Alice Staff').length).toBeGreaterThan(0);
    });

    // Alice Staff's request: Lead can decide (Approve / Reject buttons visible)
    expect(screen.getAllByTestId('approval-approve-btn-app-001').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('approval-reject-btn-app-001').length).toBeGreaterThan(0);

    // Lead's own request (app-002): Self-approval is forbidden
    expect(screen.queryByTestId('approval-approve-btn-app-002')).not.toBeInTheDocument();
    expect(screen.queryByTestId('approval-reject-btn-app-002')).not.toBeInTheDocument();
    expect(screen.getAllByText('Self-approval forbidden').length).toBeGreaterThan(0);
  });

  it('opens approval decision modal and submits atomic approval with comment', async () => {
    vi.mocked(approvalsApi.approveRequest).mockResolvedValue({
      ...mockApprovals[0]!,
      status: 'approved',
    });

    const onDecisionSuccess = vi.fn();
    render(<LeaveApprovalsTab onDecisionSuccess={onDecisionSuccess} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('approval-approve-btn-app-001').length).toBeGreaterThan(0);
    });

    // Click Approve button
    fireEvent.click(screen.getAllByTestId('approval-approve-btn-app-001')[0]!);

    // Modal opens
    expect(screen.getByRole('heading', { name: 'Approve Request' })).toBeInTheDocument();

    // Add optional comment
    const commentInput = screen.getByTestId('approval-comment-input');
    fireEvent.change(commentInput, { target: { value: 'Approved, cover arranged.' } });

    // Confirm decision
    const confirmBtn = screen.getByTestId('confirm-decision-button');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(approvalsApi.approveRequest).toHaveBeenCalledWith(
        'app-001',
        'Approved, cover arranged.',
      );
      expect(onDecisionSuccess).toHaveBeenCalled();
    });

    // Feedback alert rendered
    await waitFor(() => {
      expect(
        screen.getByText(
          /Leave request for Alice Staff was approved. Balances updated atomically./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it('opens rejection decision modal and validates comment before submitting', async () => {
    vi.mocked(approvalsApi.rejectRequest).mockResolvedValue({
      ...mockApprovals[0]!,
      status: 'rejected',
    });

    render(<LeaveApprovalsTab />);

    await waitFor(() => {
      expect(screen.getAllByTestId('approval-reject-btn-app-001').length).toBeGreaterThan(0);
    });

    // Click Reject button
    fireEvent.click(screen.getAllByTestId('approval-reject-btn-app-001')[0]!);

    expect(screen.getByRole('heading', { name: 'Reject Request' })).toBeInTheDocument();

    // Clicking confirm without comment shows validation error
    const confirmBtn = screen.getByTestId('confirm-decision-button');
    fireEvent.click(confirmBtn);

    expect(
      screen.getByText('Please provide a reason for rejecting this request.'),
    ).toBeInTheDocument();
    expect(approvalsApi.rejectRequest).not.toHaveBeenCalled();

    // Fill reason
    const commentInput = screen.getByTestId('approval-comment-input');
    fireEvent.change(commentInput, { target: { value: 'Critical project release week' } });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(approvalsApi.rejectRequest).toHaveBeenCalledWith(
        'app-001',
        'Critical project release week',
      );
    });
  });

  it('opens details modal and displays leave dates, duration, reason, and atomic balance impact', async () => {
    render(<LeaveApprovalsTab />);

    await waitFor(() => {
      expect(screen.getAllByTestId('approval-details-btn-app-001').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTestId('approval-details-btn-app-001')[0]!);

    await waitFor(() => {
      expect(leaveApi.fetchLeaveRequest).toHaveBeenCalledWith('req-001');
      expect(screen.getByTestId('leave-approval-specifics')).toBeInTheDocument();
    });

    expect(screen.getByText('Paid Time Off')).toBeInTheDocument();
    expect(screen.getByText('2026-11-16 to 2026-11-20')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
    expect(screen.getByText('Family vacation trip')).toBeInTheDocument();
    expect(screen.getByText(/Atomic Balance Update:/i)).toBeInTheDocument();
  });

  it('filters approvals by status chips and filters by search input', async () => {
    render(<LeaveApprovalsTab />);

    await waitFor(() => {
      expect(screen.getAllByText('Alice Staff').length).toBeGreaterThan(0);
    });

    // Click "Approved" filter chip
    fireEvent.click(screen.getByTestId('approvals-filter-approved'));
    await waitFor(() => {
      expect(approvalsApi.fetchApprovals).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
    });

    // Search input
    const searchInput = screen.getByTestId('approvals-search-input');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getAllByText('Alice Staff').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob Staff')).not.toBeInTheDocument();
  });
});
