import React from 'react';
import { useInRouterContext, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { canDecideApproval } from '../approval-permissions';
import { PageContainer } from '../../../components/ui/PageContainer';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { KpiCard } from '../../../components/ui/KpiCard';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ApprovalStatusBadge } from '../components/ApprovalStatusBadge';
import { ApprovalStagePill } from '../components/ApprovalStagePill';
import { ApprovalFiltersBar } from '../components/ApprovalFilters';
import { ApprovalCard } from '../components/ApprovalCard';
import { ApprovalDecisionModal } from '../components/ApprovalDecisionModal';
import { ApprovalDetailsModal } from '../components/ApprovalDetailsModal';
import { useApprovals } from '../hooks/useApprovals';
import type { Approval } from '../types';

interface ApprovalsInboxPageContentProps {
  paramId?: string;
  onNavigate?: (path: string, options?: { replace?: boolean }) => void;
}

const ApprovalsInboxPageContent: React.FC<ApprovalsInboxPageContentProps> = ({
  paramId,
  onNavigate,
}) => {
  const { user, role } = useAuth();
  const mayDecide = (approval: Approval) =>
    canDecideApproval(approval, user?.employeeId, user?.roles ?? (role ? [role] : []));
  const {
    approvals,
    meta,
    isLoading,
    error,
    filters,
    page,
    setFilters,
    setPage,
    refetch,
    selectedApproval,
    decisionOutcome,
    isDecisionModalOpen,
    isDetailsModalOpen,
    openApprove,
    openReject,
    openDetails,
    closeDecisionModal,
    closeDetailsModal,
    submitDecision,
  } = useApprovals();

  // Auto-open approval details modal when accessed via /approvals/:id
  React.useEffect(() => {
    if (paramId && approvals.length > 0) {
      const found = approvals.find((a) => a.id === paramId);
      if (found) {
        openDetails(found);
      }
    }
  }, [paramId, approvals, openDetails]);

  const handleCloseDetails = () => {
    closeDetailsModal();
    if (paramId && onNavigate) {
      onNavigate('/approvals', { replace: true });
    }
  };

  // Metrics summary
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;
  const approvedCount = approvals.filter((a) => a.status === 'approved').length;
  const rejectedCount = approvals.filter((a) => a.status === 'rejected').length;

  const columns: Column<Approval>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (row) => (
        <div>
          <span className="font-medium text-text block">{row.requesterName}</span>
          <span className="text-xs text-text-subtle font-mono">
            {row.requesterEmployeeId.slice(0, 8)}...
          </span>
        </div>
      ),
      sortable: false,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <span className="capitalize text-sm text-text font-medium">
          {row.subjectType.replace(/_/g, ' ')}
        </span>
      ),
      sortable: false,
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => {
        const currentStageName = row.stages[row.currentStage];
        return (
          <ApprovalStagePill
            stage={currentStageName}
            stageIndex={row.currentStage}
            totalStages={row.stages.length}
            isComplete={row.status !== 'pending'}
          />
        );
      },
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
        <span className="text-xs text-text-muted">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
      sortable: false,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const canDecide = mayDecide(row);
        return (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openDetails(row)}
              data-testid={`table-details-button-${row.id}`}
            >
              Details
            </Button>
            {canDecide && (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => openReject(row)}
                  data-testid={`table-reject-button-${row.id}`}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openApprove(row)}
                  data-testid={`table-approve-button-${row.id}`}
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
    <PageContainer>
      <div className="space-y-6" data-testid="approvals-inbox-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-text tracking-tight">
              Approvals Inbox
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Review and decide pending leave requests, attendance corrections, and expense claims.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="self-start sm:self-auto min-h-[44px]"
            data-testid="refresh-approvals-button"
          >
            Refresh Inbox
          </Button>
        </div>

        {/* Metrics Grid (Universal KpiCard matching approved pattern) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <KpiCard
            label="Total Requests"
            value={meta.total}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            variant="teal"
          />
          <KpiCard
            label="Pending Requests"
            value={pendingCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            variant="amber"
          />
          <KpiCard
            label="Approved Requests"
            value={approvedCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            variant="emerald"
          />
          <KpiCard
            label="Rejected Requests"
            value={rejectedCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            variant="rose"
          />
        </div>

        {/* Filter Bar */}
        <ApprovalFiltersBar filters={filters} onChange={setFilters} isLoading={isLoading} />

        {/* Main Content Area */}
        {isLoading ? (
          <div
            className="space-y-3 p-4 bg-surface rounded-card border border-border"
            data-testid="approvals-loading"
          >
            <Skeleton className="h-8 w-1/4 rounded-control" />
            <Skeleton className="h-12 w-full rounded-control" />
            <Skeleton className="h-12 w-full rounded-control" />
            <Skeleton className="h-12 w-full rounded-control" />
          </div>
        ) : error ? (
          <ErrorState title="Unable to load approvals" message={error} onRetry={refetch} />
        ) : approvals.length === 0 ? (
          <EmptyState
            title="No approval requests"
            description={
              filters.awaitingMyDecision
                ? 'You have no pending requests awaiting your decision.'
                : 'No approval requests match the current filters.'
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View (≥ 1024px) */}
            <div className="hidden lg:block bg-surface rounded-card border border-border overflow-hidden shadow-card">
              <DataTable
                columns={columns}
                data={approvals}
                keyExtractor={(row) => row.id}
                ariaLabel="Approvals Inbox Table"
              />
            </div>

            {/* Mobile & Tablet Card Grid (< 1024px) */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4"
              data-testid="approvals-mobile-cards"
            >
              {approvals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  canDecide={mayDecide(approval)}
                  onApprove={openApprove}
                  onReject={openReject}
                  onViewDetails={openDetails}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {meta.total > meta.pageSize && (
              <div className="flex items-center justify-between p-4 bg-surface rounded-card border border-border text-sm">
                <span className="text-text-muted">
                  Showing {(page - 1) * meta.pageSize + 1} to{' '}
                  {Math.min(page * meta.pageSize, meta.total)} of {meta.total} requests
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="min-h-[44px]"
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-text font-medium">Page {page}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page * meta.pageSize >= meta.total}
                    onClick={() => setPage(page + 1)}
                    className="min-h-[44px]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Decision Modal */}
        <ApprovalDecisionModal
          isOpen={isDecisionModalOpen}
          onClose={closeDecisionModal}
          approval={selectedApproval}
          outcome={decisionOutcome}
          onConfirm={submitDecision}
        />

        {/* Details & Audit History Modal */}
        <ApprovalDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetails}
          approval={selectedApproval}
          onApproveClick={openApprove}
          onRejectClick={openReject}
          canDecide={selectedApproval ? mayDecide(selectedApproval) : false}
        />
      </div>
    </PageContainer>
  );
};

function RouterApprovalsInboxPage() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  return <ApprovalsInboxPageContent paramId={params.id} onNavigate={navigate} />;
}

export const ApprovalsInboxPage: React.FC = () => {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterApprovalsInboxPage />;
  }
  return <ApprovalsInboxPageContent />;
};
