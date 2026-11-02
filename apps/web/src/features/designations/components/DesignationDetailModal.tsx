import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import type { Designation, DepartmentOption } from '../types';

export interface DesignationDetailModalProps {
  isOpen: boolean;
  designation: Designation | null;
  departmentMap: Map<string, DepartmentOption>;
  onClose: () => void;
}

export function DesignationDetailModal({
  isOpen,
  designation,
  departmentMap,
  onClose,
}: DesignationDetailModalProps) {
  if (!designation) return null;

  const dept = departmentMap.get(designation.departmentId);
  const departmentName = dept ? `${dept.name} (${dept.code})` : designation.departmentId;

  const formatDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Designation Details"
      maxWidth="md"
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="min-h-[44px]"
          data-testid="designation-detail-close"
        >
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-xs sm:text-sm" data-testid="designation-detail-content">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-text-muted font-medium">Status</span>
          <Badge variant={designation.isActive ? 'success' : 'neutral'}>
            {designation.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-border">
          <div>
            <span className="text-text-muted font-medium block">Designation Title</span>
            <span className="text-text font-semibold text-sm">{designation.title}</span>
          </div>
          <div>
            <span className="text-text-muted font-medium block">Designation Code</span>
            <span className="font-mono text-text font-semibold text-sm">{designation.code}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-border">
          <div>
            <span className="text-text-muted font-medium block">Department</span>
            <span className="text-text font-semibold">{departmentName}</span>
          </div>
          <div>
            <span className="text-text-muted font-medium block">Hierarchy Level</span>
            <span className="text-primary-ink font-semibold font-mono">
              Level {designation.level}
            </span>
          </div>
        </div>

        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-text-muted font-medium block">Designation ID</span>
          <span className="font-mono text-[11px] text-text-subtle select-all break-all">
            {designation.id}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-text-muted text-xs">
          <div>
            <span className="block font-medium">Created At</span>
            <span className="text-text">{formatDate(designation.createdAt)}</span>
          </div>
          <div>
            <span className="block font-medium">Last Updated</span>
            <span className="text-text">{formatDate(designation.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
