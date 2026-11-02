import { useState, useEffect, useCallback } from 'react';
import type { Approval, ApprovalFilters, ApprovalOutcome, ApprovalPaginationMeta } from '../types';
import { fetchApprovals, approveRequest, rejectRequest } from '../api/approvals';

export interface UseApprovalsOptions {
  initialFilters?: ApprovalFilters;
  initialPage?: number;
  pageSize?: number;
}

export function useApprovals(options: UseApprovalsOptions = {}) {
  const [filters, setFiltersState] = useState<ApprovalFilters>(options.initialFilters ?? {});
  const [page, setPageState] = useState<number>(options.initialPage ?? 1);
  const pageSize = options.pageSize ?? 20;

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [meta, setMeta] = useState<ApprovalPaginationMeta>({
    page: 1,
    pageSize,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Decision Modal State
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<ApprovalOutcome | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchApprovals({
        ...filters,
        page,
        pageSize,
      });
      setApprovals(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setFilters = useCallback((newFilters: ApprovalFilters) => {
    setFiltersState(newFilters);
    setPageState(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  const openApprove = useCallback((approval: Approval) => {
    setSelectedApproval(approval);
    setDecisionOutcome('approved');
    setIsDecisionModalOpen(true);
  }, []);

  const openReject = useCallback((approval: Approval) => {
    setSelectedApproval(approval);
    setDecisionOutcome('rejected');
    setIsDecisionModalOpen(true);
  }, []);

  const openDetails = useCallback((approval: Approval) => {
    setSelectedApproval(approval);
    setIsDetailsModalOpen(true);
  }, []);

  const closeDecisionModal = useCallback(() => {
    setIsDecisionModalOpen(false);
    setSelectedApproval(null);
    setDecisionOutcome(null);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedApproval(null);
  }, []);

  const submitDecision = useCallback(
    async (comment: string) => {
      if (!selectedApproval || !decisionOutcome) return;

      if (decisionOutcome === 'approved') {
        await approveRequest(selectedApproval.id, comment);
      } else {
        await rejectRequest(selectedApproval.id, comment);
      }

      await loadData();
    },
    [selectedApproval, decisionOutcome, loadData],
  );

  return {
    approvals,
    meta,
    isLoading,
    error,
    filters,
    page,
    setFilters,
    setPage,
    refetch: loadData,
    // Modals
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
  };
}
