import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { AuditOutcomeBadge } from './AuditOutcomeBadge';
import { formatInTimezone } from '../hooks/useCompanyTimezone';
import type { AuditLogItem } from '../types';

interface AuditLogDetailModalProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
  timezone: string;
}

export function AuditLogDetailModal({
  log,
  isOpen,
  onClose,
  timezone,
}: AuditLogDetailModalProps) {
  const [copiedType, setCopiedType] = useState<'changes' | 'metadata' | null>(null);

  if (!log) return null;

  const handleCopy = (data: Record<string, unknown> | null, type: 'changes' | 'metadata') => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const formattedTime = formatInTimezone(log.occurredAt, timezone, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Trail Entry"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-text-subtle italic">
            Append-only immutable record (read-only)
          </span>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="close-modal-btn">
            Close
          </Button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5" data-testid="audit-log-detail-modal">
        {/* Top Summary Banner */}
        <div className="p-3.5 bg-surface-muted border border-border rounded-tile space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-medium text-text-muted">ID: {log.id}</span>
            <AuditOutcomeBadge outcome={log.outcome} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="text-text-subtle block">Occurred At ({timezone}):</span>
              <span className="font-medium text-text">{formattedTime}</span>
            </div>
            <div>
              <span className="text-text-subtle block">Action:</span>
              <span className="font-mono font-semibold text-primary-ink">{log.action}</span>
            </div>
          </div>
        </div>

        {/* Actor & Entity Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-surface border border-border rounded-tile space-y-1.5">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">Actor</h4>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-text-subtle">Name: </span>
                <span className="font-medium text-text">
                  {log.actor?.name || 'System / Automated'}
                </span>
              </div>
              <div>
                <span className="text-text-subtle">Role: </span>
                <span className="font-medium text-text">{log.actor?.role || 'N/A'}</span>
              </div>
              <div>
                <span className="text-text-subtle">Actor ID: </span>
                <span className="font-mono text-text-muted text-[11px] break-all">
                  {log.actor?.id || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-surface border border-border rounded-tile space-y-1.5">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">Entity & Request</h4>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-text-subtle">Type: </span>
                <span className="font-mono font-medium text-text">{log.entityType}</span>
              </div>
              <div>
                <span className="text-text-subtle">Entity ID: </span>
                <span className="font-mono text-text-muted text-[11px] break-all">
                  {log.entityId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-text-subtle">Request ID: </span>
                <span className="font-mono text-text-muted text-[11px] break-all">
                  {log.requestId || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Changes (Redacted) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Recorded Changes
            </h4>
            {log.changes && (
              <button
                type="button"
                onClick={() => handleCopy(log.changes, 'changes')}
                className="text-xs text-primary-ink hover:underline font-medium"
              >
                {copiedType === 'changes' ? 'Copied!' : 'Copy Changes JSON'}
              </button>
            )}
          </div>
          {log.changes ? (
            <pre className="p-3 bg-surface-muted border border-border rounded-tile text-xs font-mono text-text max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
              {JSON.stringify(log.changes, null, 2)}
            </pre>
          ) : (
            <div className="p-3 bg-surface-muted border border-border rounded-tile text-xs text-text-subtle italic">
              No recorded property changes for this event.
            </div>
          )}
        </div>

        {/* Metadata (Redacted) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">Metadata</h4>
            {log.metadata && (
              <button
                type="button"
                onClick={() => handleCopy(log.metadata, 'metadata')}
                className="text-xs text-primary-ink hover:underline font-medium"
              >
                {copiedType === 'metadata' ? 'Copied!' : 'Copy Metadata JSON'}
              </button>
            )}
          </div>
          {log.metadata ? (
            <pre className="p-3 bg-surface-muted border border-border rounded-tile text-xs font-mono text-text max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          ) : (
            <div className="p-3 bg-surface-muted border border-border rounded-tile text-xs text-text-subtle italic">
              No additional metadata recorded.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
