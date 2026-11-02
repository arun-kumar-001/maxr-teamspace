import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import type { Department } from '../types';

export interface DepartmentDetailModalProps {
  isOpen: boolean;
  department: Department | null;
  onClose: () => void;
}

export function DepartmentDetailModal({ isOpen, department, onClose }: DepartmentDetailModalProps) {
  if (!department) return null;

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
      title="Department Details"
      maxWidth="md"
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="min-h-[44px]"
          data-testid="department-detail-close"
        >
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-xs sm:text-sm" data-testid="department-detail-content">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-text-muted font-medium">Status</span>
          <Badge variant={department.isActive ? 'success' : 'neutral'}>
            {department.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-border">
          <div>
            <span className="text-text-muted font-medium block">Department Name</span>
            <span className="text-text font-semibold text-sm">{department.name}</span>
          </div>
          <div>
            <span className="text-text-muted font-medium block">Department Code</span>
            <span className="font-mono text-text font-semibold text-sm">{department.code}</span>
          </div>
        </div>

        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-text-muted font-medium block">Department ID</span>
          <span className="font-mono text-[11px] text-text-subtle select-all break-all">
            {department.id}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-text-muted text-xs">
          <div>
            <span className="block font-medium">Created At</span>
            <span className="text-text">{formatDate(department.createdAt)}</span>
          </div>
          <div>
            <span className="block font-medium">Last Updated</span>
            <span className="text-text">{formatDate(department.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
