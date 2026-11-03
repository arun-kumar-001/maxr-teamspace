import { Button } from '../../../components/ui/Button';
import { AuditOutcomeBadge } from './AuditOutcomeBadge';
import { formatInTimezone } from '../hooks/useCompanyTimezone';
import type { AuditLogItem } from '../types';

interface AuditLogCardProps {
  log: AuditLogItem;
  timezone: string;
  onViewDetails: (log: AuditLogItem) => void;
}

export function AuditLogCard({ log, timezone, onViewDetails }: AuditLogCardProps) {
  const formattedTime = formatInTimezone(log.occurredAt, timezone, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-3"
      data-testid={`audit-card-${log.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-xs font-semibold text-primary-ink block">
            {log.action}
          </span>
          <span className="text-xs text-text-muted">{formattedTime}</span>
        </div>
        <AuditOutcomeBadge outcome={log.outcome} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-b border-border">
        <div>
          <span className="text-text-subtle block">Actor:</span>
          <span className="font-medium text-text truncate block">
            {log.actor?.name || 'System'}
          </span>
          <span className="text-[11px] text-text-muted">
            {log.actor?.role ? `(${log.actor.role})` : ''}
          </span>
        </div>
        <div>
          <span className="text-text-subtle block">Entity:</span>
          <span className="font-mono font-medium text-text truncate block">
            {log.entityType}
          </span>
          <span className="font-mono text-[11px] text-text-muted truncate block">
            {log.entityId || 'N/A'}
          </span>
        </div>
      </div>

      <div className="pt-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full min-h-[44px] flex items-center justify-center text-xs"
          onClick={() => onViewDetails(log)}
          data-testid={`view-details-${log.id}`}
        >
          View Details & Changes
        </Button>
      </div>
    </div>
  );
}
