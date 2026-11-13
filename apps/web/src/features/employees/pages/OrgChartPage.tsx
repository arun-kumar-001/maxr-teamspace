import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Button, EmptyState, ErrorState, ForbiddenState } from '../../../components/ui';
import { fetchEmployeeDetail } from '../api/detail';
import { ChangeManagerModal } from '../components/ChangeManagerModal';
import { OrgChartNode } from '../components/OrgChartNode';
import { useOrgChart } from '../hooks/useOrgChart';
import type { OrgNode } from '../types';

export function OrgChartPage() {
  const navigate = useNavigate();
  const { user, role: authRole } = useAuth();
  const role = user?.role ?? authRole;
  const canManageManager = role === 'admin' || role === 'hr_manager';

  const {
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
  } = useOrgChart();

  const [managingEmployee, setManagingEmployee] = useState<{
    id: string;
    name: string;
    employeeCode: string;
    version: number;
    manager?: { id: string; name?: string; employeeCode?: string } | null;
  } | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  const visibleCount = useMemo(() => {
    const seen = new Set<string>();
    for (const r of roots) seen.add(r.id);
    for (const list of Object.values(childrenMap)) {
      for (const child of list) seen.add(child.id);
    }
    return seen.size;
  }, [roots, childrenMap]);

  const handleOpenManagerModal = async (node: OrgNode) => {
    // Open immediately with node fallback, then hydrate real version & manager for optimistic locking
    setManagingEmployee({
      id: node.id,
      name: node.name,
      employeeCode: node.employeeCode,
      version: 1,
      manager: null,
    });
    try {
      const detail = await fetchEmployeeDetail(node.id);
      if (detail) {
        setManagingEmployee({
          id: detail.id,
          name: `${detail.firstName} ${detail.lastName}`.trim(),
          employeeCode: detail.employeeCode,
          version: detail.version ?? 1,
          manager: detail.manager
            ? {
                id: detail.manager.id,
                employeeCode: detail.manager.employeeCode,
                name: `${detail.manager.firstName} ${detail.manager.lastName}`.trim(),
              }
            : null,
        });
      }
    } catch {
      // Fallback already shown
    }
  };

  const renderRecursiveNode = (node: OrgNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedNodeIds.has(node.id);
    const isLoading = loadingNodeIds.has(node.id);
    const children = childrenMap[node.id] || [];
    const error = nodeErrors[node.id];

    return (
      <div key={node.id} className="w-full">
        <OrgChartNode
          node={node}
          isExpanded={isExpanded}
          isLoading={isLoading}
          childrenNodes={children}
          error={error}
          onToggle={toggleNode}
          onViewProfile={(id) => navigate(`/employees/${id}`)}
          onChangeManager={canManageManager ? handleOpenManagerModal : undefined}
          canManageManager={canManageManager}
          depth={depth}
          renderChild={renderRecursiveNode}
        />
      </div>
    );
  };

  // Forbidden state
  if (rootError && rootError.isForbidden) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="org-chart-forbidden">
        <ForbiddenState
          message="You do not have permission to view the organization chart."
          actionLabel="Back to Employee Directory"
          onAction={() => navigate('/employees')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" data-testid="org-chart-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="text-xs font-medium text-primary-deep hover:underline flex items-center gap-1 focus:outline-none cursor-pointer"
              data-testid="back-to-directory-link"
            >
              &larr; Back to Employee Directory
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-text">
            Organization Hierarchy
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Visualize reporting lines, managerial tiers, and team reporting structures.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status filter buttons */}
          <div className="flex items-center bg-surface-muted p-1 rounded-control border border-border text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid="filter-active-btn"
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(undefined)}
              className={`px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${
                statusFilter === undefined
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid="filter-all-btn"
            >
              All Statuses
            </button>
          </div>

          {/* Zoom Controls */}
          <div
            className="flex items-center bg-surface-muted p-1 rounded-control border border-border text-xs"
            data-testid="org-chart-zoom-controls"
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(75, z - 25))}
              disabled={zoom <= 75}
              className="px-2.5 py-1 rounded-sm font-semibold text-text hover:bg-surface disabled:opacity-40 transition-colors cursor-pointer"
              title="Zoom out"
              aria-label="Zoom out"
              data-testid="org-zoom-out"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="px-2.5 py-1 rounded-sm font-mono font-medium text-text hover:bg-surface transition-colors cursor-pointer"
              title="Reset zoom"
              data-testid="org-zoom-reset"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(125, z + 25))}
              disabled={zoom >= 125}
              className="px-2.5 py-1 rounded-sm font-semibold text-text hover:bg-surface disabled:opacity-40 transition-colors cursor-pointer"
              title="Zoom in"
              aria-label="Zoom in"
              data-testid="org-zoom-in"
            >
              +
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined' && typeof window.print === 'function') {
                window.print();
              }
            }}
            className="text-xs min-h-[38px]"
            data-testid="export-org-chart-btn"
          >
            Print / Export
          </Button>

          {/* Expand All */}
          {roots.some((r) => r.directReportCount > 0) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={expandingAll}
              onClick={() => void expandAll()}
              className="text-xs min-h-[38px]"
              data-testid="expand-all-btn"
            >
              {expandingAll ? 'Expanding...' : 'Expand All'}
            </Button>
          )}

          {/* Collapse All */}
          {expandedNodeIds.size > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="text-xs min-h-[38px]"
              data-testid="collapse-all-btn"
            >
              Collapse All
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            className="text-xs min-h-[38px]"
            data-testid="reload-org-chart-btn"
          >
            Refresh Chart
          </Button>
        </div>
      </div>

      {/* Main Hierarchy Tree View */}
      {loadingRoots ? (
        <div className="space-y-4 py-8" data-testid="org-chart-loading">
          <div className="max-w-md mx-auto h-28 bg-surface-muted animate-pulse rounded-tile border border-border" />
          <div className="max-w-md mx-auto h-28 bg-surface-muted animate-pulse rounded-tile border border-border" />
        </div>
      ) : rootError ? (
        <div data-testid="org-chart-error">
          <ErrorState
            title="Failed to Load Organization Chart"
            message={rootError.message}
            onRetry={() => void reload()}
          />
        </div>
      ) : roots.length === 0 ? (
        <div className="py-12" data-testid="org-chart-empty">
          <EmptyState
            title="No Organization Roots Found"
            description="No top-level employees without a manager were found. Ensure active employees are created and configured."
            actionLabel="View Employee Directory"
            onAction={() => navigate('/employees')}
          />
        </div>
      ) : (
        <div className="space-y-6 pt-2" data-testid="org-chart-tree">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-subtle font-medium">
            <span>
              Showing {roots.length} top-level {roots.length === 1 ? 'root' : 'roots'} (employees
              with no reporting manager)
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-text-muted">
              {visibleCount} {visibleCount === 1 ? 'member' : 'members'} loaded &middot;{' '}
              {expandedNodeIds.size} {expandedNodeIds.size === 1 ? 'branch' : 'branches'} expanded
            </span>
          </div>

          <div className="overflow-x-auto pb-4">
            <div
              className="space-y-6 transition-transform duration-200 origin-top-left"
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                width: zoom !== 100 ? `${Math.round((100 / zoom) * 100)}%` : undefined,
              }}
            >
              {roots.map((root) => renderRecursiveNode(root))}
            </div>
          </div>
        </div>
      )}

      {/* Change Manager Modal */}
      {managingEmployee && (
        <ChangeManagerModal
          isOpen={Boolean(managingEmployee)}
          onClose={() => setManagingEmployee(null)}
          employee={managingEmployee}
          onSuccess={(change) => {
            handleManagerChangeSuccess(change);
            setManagingEmployee(null);
          }}
        />
      )}
    </div>
  );
}
