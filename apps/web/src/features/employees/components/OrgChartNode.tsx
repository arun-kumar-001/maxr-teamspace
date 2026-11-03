import { Badge } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';
import type { OrgNode } from '../types';

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
}: OrgChartNodeProps) {
  const initials =
    node.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  const statusVariant =
    node.status === 'active' ? 'success' : node.status === 'deactivated' ? 'danger' : 'warning';

  const hasReports = node.directReportCount > 0;

  return (
    <div
      className="flex flex-col items-center"
      data-testid={`org-node-${node.id}`}
      style={{ marginLeft: depth > 0 ? undefined : 0 }}
    >
      {/* Node Card */}
      <div
        className={`w-full max-w-sm sm:max-w-md bg-surface border rounded-tile p-4 shadow-card transition-all hover:border-primary-strong/50 ${
          isExpanded ? 'border-primary-strong/40 bg-surface-raised' : 'border-border'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Avatar & Core Info */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center shrink-0 text-sm border border-primary/20"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onViewProfile(node.id)}
                className="text-left font-semibold text-text hover:text-primary-deep hover:underline truncate block text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-primary-strong rounded-sm"
                title={`View ${node.name}'s profile`}
                data-testid={`view-profile-btn-${node.id}`}
              >
                {node.name}
              </button>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-text-muted">{node.employeeCode}</span>
                <span className="text-xs text-text-subtle">•</span>
                <span className="text-xs text-text-muted truncate">{node.designation}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="shrink-0">
            <Badge variant={statusVariant}>{node.status}</Badge>
          </div>
        </div>

        {/* Card Footer: Expand Toggle & Actions */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {/* Expand/Collapse Button */}
          {hasReports ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                isExpanded
                  ? 'bg-primary-deep text-white hover:bg-primary-deep/90 shadow-primary'
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
                <span className="animate-spin text-xs">⟳</span>
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
            <span className="text-xs text-text-subtle px-2 py-1 bg-surface-muted rounded-full">
              No direct reports
            </span>
          )}

          {/* Manager Action */}
          <div className="flex items-center gap-1.5 ml-auto">
            {canManageManager && onChangeManager && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChangeManager(node)}
                className="text-xs min-h-[36px] py-1 px-2.5"
                data-testid={`change-manager-btn-${node.id}`}
              >
                Change Manager
              </Button>
            )}
          </div>
        </div>

        {/* Inline error if reports failed to load */}
        {error && (
          <div
            role="alert"
            className="mt-2 p-2 bg-danger/10 border border-danger/30 rounded text-xs text-danger flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              className="text-danger underline font-medium hover:text-danger/80 ml-2"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Child Reports Branch */}
      {isExpanded && childrenNodes.length > 0 && (
        <div
          className="w-full mt-4 pl-4 sm:pl-8 border-l-2 border-primary/40 space-y-4"
          data-testid={`children-container-${node.id}`}
        >
          {childrenNodes.map((child) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
