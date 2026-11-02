// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ApprovalStatusBadge } from '../components/ApprovalStatusBadge';
import { ApprovalStagePill } from '../components/ApprovalStagePill';
import { ApprovalFiltersBar } from '../components/ApprovalFilters';
import { ApprovalCard } from '../components/ApprovalCard';
import { ApprovalDecisionModal } from '../components/ApprovalDecisionModal';
import { ApprovalDetailsModal } from '../components/ApprovalDetailsModal';
import { ApprovalsInboxPage } from '../pages/ApprovalsInboxPage';
import * as approvalsApi from '../api/approvals';
import type { Approval } from '../types';

vi.mock('../api/approvals', () => ({
  fetchApprovals: vi.fn(),
  fetchApproval: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));

const mockApprovals: Approval[] = [
  {
    id: 'app-001',
    subjectType: 'attendance_correction',
    subjectId: 'att-rec-1',
    requesterEmployeeId: 'emp-101',
    requesterName: 'Jane Doe',
    requesterManagerId: 'emp-mgr-1',
    stages: ['manager', 'hr'],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: '2026-10-25T09:00:00Z',
    decidedAt: null,
  },
  {
    id: 'app-002',
    subjectType: 'leave_request',
    subjectId: 'leave-rec-2',
    requesterEmployeeId: 'emp-102',
    requesterName: 'John Smith',
    requesterManagerId: 'emp-mgr-1',
    stages: ['manager'],
    currentStage: 0,
    status: 'approved',
    decisions: [
      {
        stage: 0,
        decidedByEmployeeId: 'emp-mgr-1',
        outcome: 'approved',
        comment: 'Looks good to me',
        decidedAt: '2026-10-26T10:00:00Z',
      },
    ],
    createdAt: '2026-10-24T14:30:00Z',
    decidedAt: '2026-10-26T10:00:00Z',
  },
];

describe('Approvals Feature Suite (Issue #37)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('ApprovalStatusBadge', () => {
    it('renders correct labels for each status', () => {
      const { rerender } = render(<ApprovalStatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();

      rerender(<ApprovalStatusBadge status="approved" />);
      expect(screen.getByText('Approved')).toBeInTheDocument();

      rerender(<ApprovalStatusBadge status="rejected" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();

      rerender(<ApprovalStatusBadge status="cancelled" />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('ApprovalStagePill', () => {
    it('renders Manager Review and HR Review with step indicators', () => {
      const { rerender } = render(
        <ApprovalStagePill stage="manager" stageIndex={0} totalStages={2} />,
      );
      expect(screen.getByTestId('stage-pill-manager')).toHaveTextContent(
        'Manager Review (Step 1/2)',
      );

      rerender(<ApprovalStagePill stage="hr" stageIndex={1} totalStages={2} />);
      expect(screen.getByTestId('stage-pill-hr')).toHaveTextContent('HR Review (Step 2/2)');

      rerender(<ApprovalStagePill isComplete={true} />);
      expect(screen.getByTestId('stage-pill-complete')).toHaveTextContent('Completed');
    });
  });

  describe('ApprovalFiltersBar', () => {
    it('handles status, subject type, and awaiting toggle changes', () => {
      const onChange = vi.fn();
      render(
        <ApprovalFiltersBar
          filters={{ status: 'pending', awaitingMyDecision: false }}
          onChange={onChange}
        />,
      );

      const statusSelect = screen.getByLabelText('Filter by Status');
      fireEvent.change(statusSelect, { target: { value: 'approved' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));

      const subjectSelect = screen.getByLabelText('Filter by Subject Type');
      fireEvent.change(subjectSelect, { target: { value: 'leave_request' } });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ subjectType: 'leave_request' }),
      );

      const toggleButton = screen.getByTestId('awaiting-decision-toggle');
      fireEvent.click(toggleButton);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ awaitingMyDecision: true }));
    });
  });

  describe('ApprovalCard', () => {
    it('renders requester info, stage, and action buttons for pending approval', () => {
      const onApprove = vi.fn();
      const onReject = vi.fn();
      const onViewDetails = vi.fn();

      render(
        <ApprovalCard
          approval={mockApprovals[0]!}
          onApprove={onApprove}
          onReject={onReject}
          onViewDetails={onViewDetails}
        />,
      );

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('attendance correction')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('card-details-button-app-001'));
      expect(onViewDetails).toHaveBeenCalledWith(mockApprovals[0]!);

      fireEvent.click(screen.getByTestId('card-approve-button-app-001'));
      expect(onApprove).toHaveBeenCalledWith(mockApprovals[0]!);

      fireEvent.click(screen.getByTestId('card-reject-button-app-001'));
      expect(onReject).toHaveBeenCalledWith(mockApprovals[0]!);
    });
  });

  describe('ApprovalDecisionModal', () => {
    it('requires a comment when rejecting and calls onConfirm', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApprovalDecisionModal
          isOpen={true}
          onClose={onClose}
          approval={mockApprovals[0]!}
          outcome="rejected"
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText('Reject Request')).toBeInTheDocument();

      // Attempt submit without comment
      fireEvent.click(screen.getByTestId('confirm-decision-button'));
      expect(
        screen.getByText('Please provide a reason for rejecting this request.'),
      ).toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();

      // Enter comment and submit
      const commentInput = screen.getByTestId('approval-comment-input');
      fireEvent.change(commentInput, { target: { value: 'Times overlap with another shift' } });
      fireEvent.click(screen.getByTestId('confirm-decision-button'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Times overlap with another shift');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('allows approving with an optional comment', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApprovalDecisionModal
          isOpen={true}
          onClose={onClose}
          approval={mockApprovals[0]!}
          outcome="approved"
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText('Approve Request')).toBeInTheDocument();

      // Submit without entering a comment
      fireEvent.click(screen.getByTestId('confirm-decision-button'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('ApprovalDetailsModal', () => {
    it('renders full metadata and audit decision entries', () => {
      render(<ApprovalDetailsModal isOpen={true} onClose={vi.fn()} approval={mockApprovals[1]!} />);

      expect(screen.getByText('Approval Request Details')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Decision History')).toBeInTheDocument();
      expect(screen.getByTestId('decision-entry-0')).toBeInTheDocument();
      expect(screen.getByText('Looks good to me')).toBeInTheDocument();
    });
  });

  describe('ApprovalsInboxPage', () => {
    it('renders inbox layout, metrics, and approval records in table and cards', async () => {
      vi.mocked(approvalsApi.fetchApprovals).mockResolvedValue({
        data: mockApprovals,
        meta: {
          page: 1,
          pageSize: 20,
          total: 2,
        },
      });

      render(<ApprovalsInboxPage />);

      await waitFor(() => {
        expect(screen.getByText('Approvals Inbox')).toBeInTheDocument();
      });

      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('approvals-mobile-cards')).toBeInTheDocument();
    });

    it('renders empty state when no approvals exist', async () => {
      vi.mocked(approvalsApi.fetchApprovals).mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
        },
      });

      render(<ApprovalsInboxPage />);

      await waitFor(() => {
        expect(screen.getByText('No approval requests')).toBeInTheDocument();
      });
    });
  });
});
