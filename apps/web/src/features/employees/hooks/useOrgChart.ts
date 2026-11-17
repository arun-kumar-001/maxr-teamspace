import { useCallback, useEffect, useState } from 'react';
import { fetchDirectReports, fetchOrgRoots, HierarchyApiError } from '../api/hierarchy';
import type { EmployeeStatus, ManagerChange, OrgNode } from '../types';

export interface UseOrgChartResult {
  roots: OrgNode[];
  statusFilter: EmployeeStatus | undefined;
  setStatusFilter: (status: EmployeeStatus | undefined) => void;
  loadingRoots: boolean;
  expandingAll: boolean;
  rootError: HierarchyApiError | null;
  childrenMap: Record<string, OrgNode[]>;
  expandedNodeIds: Set<string>;
  loadingNodeIds: Set<string>;
  nodeErrors: Record<string, string>;
  toggleNode: (nodeId: string) => Promise<void>;
  expandAll: () => Promise<void>;
  collapseAll: () => void;
  reload: () => Promise<void>;
  handleManagerChangeSuccess: (change: ManagerChange) => void;
}

export function useOrgChart(): UseOrgChartResult {
  const [roots, setRoots] = useState<OrgNode[]>([]);
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | undefined>('active');
  const [loadingRoots, setLoadingRoots] = useState(true);
  const [expandingAll, setExpandingAll] = useState(false);
  const [rootError, setRootError] = useState<HierarchyApiError | null>(null);

  const [childrenMap, setChildrenMap] = useState<Record<string, OrgNode[]>>({});
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set());
  const [nodeErrors, setNodeErrors] = useState<Record<string, string>>({});

  const loadRoots = useCallback(async (status?: EmployeeStatus) => {
    setLoadingRoots(true);
    setRootError(null);
    try {
      const res = await fetchOrgRoots({ status, page: 1, pageSize: 100 });
      setRoots(res.data);
    } catch (err) {
      if (err instanceof HierarchyApiError) {
        setRootError(err);
      } else {
        setRootError(new HierarchyApiError(500, 'An unexpected error occurred loading roots'));
      }
    } finally {
      setLoadingRoots(false);
    }
  }, []);

  useEffect(() => {
    void loadRoots(statusFilter);
    // Reset expanded tree state when filter changes
    setChildrenMap({});
    setExpandedNodeIds(new Set());
    setNodeErrors({});
  }, [statusFilter, loadRoots]);

  const toggleNode = useCallback(
    async (nodeId: string) => {
      // If already expanded, collapse it
      if (expandedNodeIds.has(nodeId)) {
        setExpandedNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // If children already fetched, just expand
      if (childrenMap[nodeId]) {
        setExpandedNodeIds((prev) => new Set(prev).add(nodeId));
        return;
      }

      // Fetch direct reports
      setLoadingNodeIds((prev) => new Set(prev).add(nodeId));
      setNodeErrors((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });

      try {
        const res = await fetchDirectReports(nodeId, {
          status: statusFilter,
          page: 1,
          pageSize: 100,
        });
        setChildrenMap((prev) => ({ ...prev, [nodeId]: res.data }));
        setExpandedNodeIds((prev) => new Set(prev).add(nodeId));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load direct reports';
        setNodeErrors((prev) => ({ ...prev, [nodeId]: msg }));
      } finally {
        setLoadingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [childrenMap, expandedNodeIds, statusFilter],
  );

  const expandAll = useCallback(async () => {
    if (roots.length === 0) return;
    setExpandingAll(true);
    try {
      const nextMap: Record<string, OrgNode[]> = { ...childrenMap };
      const nextExpanded = new Set<string>(expandedNodeIds);
      const visited = new Set<string>();
      const queue: OrgNode[] = [...roots];

      while (queue.length > 0) {
        const batch = queue
          .splice(0, 10)
          .filter((n) => n.directReportCount > 0 && !visited.has(n.id));
        if (batch.length === 0) continue;

        for (const n of batch) visited.add(n.id);

        const results = await Promise.all(
          batch.map(async (node) => {
            if (nextMap[node.id]) {
              return { id: node.id, data: nextMap[node.id]! };
            }
            const res = await fetchDirectReports(node.id, {
              status: statusFilter,
              page: 1,
              pageSize: 100,
            });
            return { id: node.id, data: res.data };
          }),
        );

        for (const item of results) {
          nextMap[item.id] = item.data;
          nextExpanded.add(item.id);
          for (const child of item.data) {
            if (child.directReportCount > 0 && !visited.has(child.id)) {
              queue.push(child);
            }
          }
        }
      }

      setChildrenMap(nextMap);
      setExpandedNodeIds(nextExpanded);
    } catch {
      // Individual errors surface on manual expand
    } finally {
      setExpandingAll(false);
    }
  }, [roots, childrenMap, expandedNodeIds, statusFilter]);

  const collapseAll = useCallback(() => {
    setExpandedNodeIds(new Set());
  }, []);

  const reload = useCallback(async () => {
    await loadRoots(statusFilter);
    // Also re-fetch currently expanded branches
    const currentExpanded = Array.from(expandedNodeIds);
    if (currentExpanded.length > 0) {
      const newChildrenMap: Record<string, OrgNode[]> = {};
      for (const id of currentExpanded) {
        try {
          const res = await fetchDirectReports(id, {
            status: statusFilter,
            page: 1,
            pageSize: 100,
          });
          newChildrenMap[id] = res.data;
        } catch {
          // ignore individual node failure on bulk refresh
        }
      }
      setChildrenMap(newChildrenMap);
    }
  }, [expandedNodeIds, loadRoots, statusFilter]);

  const handleManagerChangeSuccess = useCallback(
    (_change: ManagerChange) => {
      // Reload the org tree so all directReportCounts and branch positions re-align
      void reload();
    },
    [reload],
  );

  return {
    roots,
    statusFilter,
    setStatusFilter,
    loadingRoots,
    expandingAll,
    rootError,
    childrenMap,
    expandedNodeIds,
    loadingNodeIds,
    nodeErrors,
    toggleNode,
    expandAll,
    collapseAll,
    reload,
    handleManagerChangeSuccess,
  };
}
