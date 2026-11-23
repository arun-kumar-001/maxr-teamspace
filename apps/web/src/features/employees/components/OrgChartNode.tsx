import React from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import type { OrgNode } from '../types';
import { getAvatarTone, getInitials } from './hiringUtils';

export interface OrgChartNodeProps {
  node: OrgNode;
  isExpanded: boolean;
  isLoading: boolean;
  childrenNodes?: OrgNode[];
  error?: string;
  onToggle: (id: string) => void;
  onViewProfile: (id: string) => void;
  onChangeManager?: (node: OrgNode) => void;
  canManageManager?: boolean;
  depth?: number;
  renderChild?: (child: OrgNode, depth: number) => React.ReactNode;
}

export function OrgChartNode({
  node,
  isExpanded,
  isLoading,
  childrenNodes = [],
  error,
  onToggle,
  onViewProfile,
  onChangeManager,
  canManageManager = false,
  depth = 0,
  renderChild,
}: OrgChartNodeProps) {
  const initials = getInitials(node.name);

  const statusVariant =
    node.status === 'active' ? 'success' : node.status === 'deactivated' ? 'danger' : 'warning';

  const hasReports = node.directReportCount > 0;
  const isRootLevel = depth === 0;

  return (
    <div
      className={`flex flex-col ${isRootLevel ? 'items-center w-full' : 'items-stretch w-full'}`}
      data-testid={`org-node-${node.id}`}
    >
      {/* Node Card */}
      <div
        className={`animate-crm-fade-up bg-surface border rounded-card p-3.5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-raised hover:border-primary-strong/50 ${
          isRootLevel
            ? 'w-full max-w-sm border-primary-strong/30'
            : 'w-full md:w-[270px] lg:w-[280px]'
        } ${isExpanded ? 'border-primary-strong/50 ring-1 ring-primary/15' : 'border-border'}`}
      >
        <div className="flex items-start justify-between gap-2.5">
          {/* Avatar & Core Info */}
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full font-semibold flex items-center justify-center shrink-0 text-xs border border-surface shadow-sm ${getAvatarTone(
                node.name,
              )}`}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onViewProfile(node.id)}
                className="text-left font-semibold text-text hover:text-primary-deep hover:underline truncate block text-sm focus:outline-none focus:ring-1 focus:ring-primary-strong rounded-sm cursor-pointer"
                title={`View ${node.name}'s profile`}
                data-testid={`view-profile-btn-${node.id}`}
              >
                {node.name}
              </button>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[11px] font-mono text-text-muted">{node.employeeCode}</span>
                <span className="text-[11px] text-text-subtle">&bull;</span>
                <span className="text-[11px] text-text-muted truncate max-w-[140px]">
                  {node.designation}
                </span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="shrink-0">
            <Badge variant={statusVariant}>
              <span className="inline-flex items-center gap-1">
                {node.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-positive-ink animate-pulse" />
                )}
                <span>{node.status}</span>
              </span>
            </Badge>
          </div>
        </div>

        {/* Card Footer: Expand Toggle & Actions */}
        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {hasReports ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors min-h-[34px] cursor-pointer ${
                isExpanded
                  ? 'bg-primary-deep text-surface hover:bg-primary-deep/90 shadow-sm'
                  : 'bg-primary-soft text-primary-ink hover:bg-primary-soft/80 border border-primary/20'
              }`}
              data-testid={`toggle-expand-${node.id}`}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? `Collapse reports for ${node.name}`
                  : `Expand ${node.directReportCount} reports for ${node.name}`
              }
            >
              {isLoading ? (
                <span className="animate-spin text-xs">&#8635;</span>
              ) : (
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              <span>
                {node.directReportCount} {node.directReportCount === 1 ? 'Report' : 'Reports'}
              </span>
            </button>
          ) : (
            <span className="text-[11px] text-text-subtle px-2 py-1 bg-surface-muted rounded-full">
              No direct reports
            </span>
          )}

          {canManageManager && onChangeManager && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChangeManager(node)}
              className="text-[11px] min-h-[34px] py-1 px-2.5 ml-auto"
              data-testid={`change-manager-btn-${node.id}`}
            >
              Change Manager
            </Button>
          )}
        </div>

        {/* Inline error if reports failed to load */}
        {error && (
          <div
            role="alert"
            className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-danger flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              className="text-danger underline font-medium hover:opacity-80 ml-2 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Child Reports Branch:
          - At depth === 0 (Root): horizontal side-by-side columns with top tree connectors
          - At depth >= 1 (Managers): stacked vertically below the manager card */}
      {isExpanded && childrenNodes.length > 0 && isRootLevel && (
        <div
          className="w-full flex flex-col items-center"
          data-testid={`children-container-${node.id}`}
        >
          {/* Vertical trunk from root */}
          <div className="hidden md:block w-0.5 h-6 bg-primary-strong/40" aria-hidden="true" />

          {/* Horizontal row of direct-report columns */}
          <div className="w-full flex flex-col md:flex-row md:items-start md:justify-center gap-4 md:gap-0 mt-3 md:mt-0">
            {childrenNodes.map((child, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === childrenNodes.length - 1;
              return (
                <div key={child.id} className="flex flex-col items-center md:px-2.5">
                  {/* Horizontal crossbar + vertical drop stem on desktop */}
                  <div className="hidden md:flex items-start w-full h-5" aria-hidden="true">
                    <div
                      className={`flex-1 h-px ${
                        isFirst ? 'bg-transparent' : 'bg-primary-strong/40'
                      }`}
                    />
                    <div className="w-0.5 h-5 bg-primary-strong/40 shrink-0" />
                    <div
                      className={`flex-1 h-px ${
                        isLast ? 'bg-transparent' : 'bg-primary-strong/40'
                      }`}
                    />
                  </div>

                  {renderChild ? (
                    renderChild(child, depth + 1)
                  ) : (
                    <OrgChartNode
                      node={child}
                      isExpanded={false}
                      isLoading={false}
                      childrenNodes={[]}
                      onToggle={onToggle}
                      onViewProfile={onViewProfile}
                      onChangeManager={onChangeManager}
                      canManageManager={canManageManager}
                      depth={depth + 1}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isExpanded && childrenNodes.length > 0 && !isRootLevel && (
        <div
          className="mt-3 pl-4 border-l-2 border-primary-strong/35 space-y-3"
          data-testid={`children-container-${node.id}`}
        >
          {childrenNodes.map((child) =>
            renderChild ? (
              renderChild(child, depth + 1)
            ) : (
              <OrgChartNode
                key={child.id}
                node={child}
                isExpanded={false}
                isLoading={false}
                childrenNodes={[]}
                onToggle={onToggle}
                onViewProfile={onViewProfile}
                onChangeManager={onChangeManager}
                canManageManager={canManageManager}
                depth={depth + 1}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
