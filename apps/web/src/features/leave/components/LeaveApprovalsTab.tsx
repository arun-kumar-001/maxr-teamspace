import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import { Button, DataTable, type Column, Badge } from '../../../components/ui';
import { fetchApprovals, approveRequest, rejectRequest } from '../../approvals/api/approvals';
import type { Approval, ApprovalStatus, ApprovalOutcome } from '../../approvals/types';
import { ApprovalStagePill } from '../../approvals/components/ApprovalStagePill';
import { ApprovalStatusBadge } from '../../approvals/components/ApprovalStatusBadge';
import { ApprovalDecisionModal } from '../../approvals/components/ApprovalDecisionModal';
import { ApprovalDetailsModal } from '../../approvals/components/ApprovalDetailsModal';

export interface LeaveApprovalsTabProps {
  onDecisionSuccess?: () => void;
}

export const LeaveApprovalsTab: React.FC<LeaveApprovalsTabProps> = ({ onDecisionSuccess }) => {
  const { user, role } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>(
    'pending',
  );

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<ApprovalOutcome | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Feedback message
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const loadApprovals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = {
        subjectType: 'leave_request',
        status: statusFilter === 'all' ? undefined : (statusFilter as ApprovalStatus),
        pageSize: 50,
      };
      const res = await fetchApprovals(query);
      setApprovals(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave approvals');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleOpenApprove = (approval: Approval) => {
    setSelectedApproval(approval);
    setDecisionOutcome('approved');
    setIsDecisionModalOpen(true);
  };

  const handleOpenReject = (approval: Approval) => {
    setSelectedApproval(approval);
    setDecisionOutcome('rejected');
    setIsDecisionModalOpen(true);
  };

  const handleOpenDetails = (approval: Approval) => {
    setSelectedApproval(approval);
    setIsDetailsModalOpen(true);
  };

  const handleConfirmDecision = async (comment: string) => {
    if (!selectedApproval || !decisionOutcome) return;

    try {
      if (decisionOutcome === 'approved') {
        await approveRequest(selectedApproval.id, comment);
        setFeedback({
          message: `Leave request for ${selectedApproval.requesterName} was approved. Balances updated atomically.`,
          type: 'success',
        });
      } else {
        await rejectRequest(selectedApproval.id, comment);
        setFeedback({
          message: `Leave request for ${selectedApproval.requesterName} was rejected.`,
          type: 'success',
        });
      }
      await loadApprovals();
      onDecisionSuccess?.();
    } catch (err) {
      setFeedback({
        message: err instanceof Error ? err.message : 'Failed to record approval decision',
        type: 'error',
      });
      throw err;
    }
  };

  // Filter approvals by search
  const filteredApprovals = approvals.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.requesterName.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.subjectId.toLowerCase().includes(q)
    );
  });

  // Calculate status counts
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  const canDecideApproval = (approval: Approval): boolean => {
    if (approval.status !== 'pending') return false;
    // Disallow self-approval
    if (user?.employeeId && approval.requesterEmployeeId === user.employeeId) {
      return false;
    }
    const currentStageName = approval.stages[approval.currentStage];
    if (currentStageName === 'manager' && (role === ROLES.TEAM_LEAD || role === ROLES.ADMIN)) {
      return true;
    }
    if (currentStageName === 'hr' && (role === ROLES.HR_MANAGER || role === ROLES.ADMIN)) {
      return true;
    }
    return false;
  };

  const columns: Column<Approval>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (row) => (
        <div>
          <span className="font-semibold text-text block">{row.requesterName}</span>
          <span className="text-xs text-text-subtle font-mono">
            {row.requesterEmployeeId.slice(0, 8)}...
          </span>
        </div>
      ),
      sortable: false,
    },
    {
      key: 'stage',
      header: 'Current Stage',
      render: (row) => (
        <ApprovalStagePill
          stage={row.stages[row.currentStage]}
          stageIndex={row.currentStage}
          totalStages={row.stages.length}
          isComplete={row.status !== 'pending'}
        />
      ),
      sortable: false,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ApprovalStatusBadge status={row.status} size="sm" />,
      sortable: false,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-text-muted font-mono">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
      sortable: false,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const isSelf = Boolean(user?.employeeId && row.requesterEmployeeId === user.employeeId);
        const canDecide = canDecideApproval(row);

        return (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenDetails(row)}
              data-testid={`approval-details-btn-${row.id}`}
              className="min-h-[36px]"
            >
              Details
            </Button>

            {isSelf && row.status === 'pending' && (
              <Badge variant="neutral" className="text-xs">
                Self-approval forbidden
              </Badge>
            )}

            {!isSelf && canDecide && (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleOpenReject(row)}
                  data-testid={`approval-reject-btn-${row.id}`}
                  className="min-h-[36px]"
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenApprove(row)}
                  data-testid={`approval-approve-btn-${row.id}`}
                  className="min-h-[36px]"
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        );
      },
      sortable: false,
    },
  ];

  return (
    <div className="space-y-6" data-testid="leave-approvals-tab-container">
      {/* Header Info */}
      <div className="p-4 bg-surface border border-border rounded-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text font-display flex items-center gap-2">
            Team Leave Approvals
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-primary-soft text-primary-deep rounded-full border border-primary/20">
                {pendingCount} Pending
              </span>
            )}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Decide team leave applications. Approvals atomically update leave balances and request
            states in one transaction.
          </p>
        </div>

        {/* Search input */}
        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search by requester..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-10 min-h-[40px]"
            data-testid="approvals-search-input"
          />
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-control text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-positive-soft text-positive-ink border border-positive-ink/20'
              : 'bg-negative-soft text-negative-ink border border-negative-ink/20'
          }`}
          data-testid="approvals-feedback-alert"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 transition-opacity"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="leave-approvals-filter-chips">
        {(
          [
            { key: 'pending', label: 'Pending Approvals' },
            { key: 'all', label: 'All Requests' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            data-testid={`approvals-filter-${f.key}`}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
              statusFilter === f.key
                ? 'bg-primary-deep text-white border-primary-deep shadow-primary'
                : 'bg-surface text-text hover:bg-surface-muted border-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-negative-soft text-negative-ink border border-negative-ink/20 rounded-tile text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-12 text-center text-text-subtle text-sm">Loading leave approvals...</div>
      ) : filteredApprovals.length === 0 ? (
        <div
          className="p-8 text-center bg-surface border border-dashed border-border rounded-tile"
          data-testid="leave-approvals-empty-state"
        >
          <p className="text-sm font-semibold text-text">No leave requests found</p>
          <p className="text-xs text-text-muted mt-1">
            {statusFilter === 'pending'
              ? 'There are no pending leave requests awaiting your decision.'
              : 'No leave applications match the selected status filter.'}
          </p>
        </div>
      ) : (
        <DataTable<Approval>
          ariaLabel="Team leave approvals table"
          data={filteredApprovals}
          columns={columns}
          keyExtractor={(item) => item.id}
        />
      )}

      {/* Decision Modal */}
      <ApprovalDecisionModal
        isOpen={isDecisionModalOpen}
        onClose={() => {
          setIsDecisionModalOpen(false);
          setSelectedApproval(null);
          setDecisionOutcome(null);
        }}
        approval={selectedApproval}
        outcome={decisionOutcome}
        onConfirm={handleConfirmDecision}
      />

      {/* Details Modal */}
      <ApprovalDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedApproval(null);
        }}
        approval={selectedApproval}
        canDecide={selectedApproval ? canDecideApproval(selectedApproval) : false}
        onApproveClick={(app) => {
          setIsDetailsModalOpen(false);
          handleOpenApprove(app);
        }}
        onRejectClick={(app) => {
          setIsDetailsModalOpen(false);
          handleOpenReject(app);
        }}
      />
    </div>
  );
};
