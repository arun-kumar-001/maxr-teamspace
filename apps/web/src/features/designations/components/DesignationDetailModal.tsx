import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/StatusPill';
import { getAvatarTone, getInitials } from '../../employees/components/hiringUtils';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { DepartmentOption, Designation } from '../types';
import { CAREER_LEVEL_BANDS, getLevelTierMeta } from './levelMeta';

export interface DesignationDetailModalProps {
  isOpen: boolean;
  designation: Designation | null;
  departmentMap: Map<string, DepartmentOption>;
  onClose: () => void;
  holders?: EmployeeDirectoryItem[];
}

export function DesignationDetailModal({
  isOpen,
  designation,
  departmentMap,
  onClose,
  holders = [],
}: DesignationDetailModalProps) {
  if (!designation) return null;

  const dept = departmentMap.get(designation.departmentId);
  const departmentName = dept ? `${dept.name} (${dept.code})` : designation.departmentId;
  const tier = getLevelTierMeta(designation.level);

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
      subtitle={`${designation.title} · ${designation.code}`}
      position="drawer"
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
      <div className="space-y-5 text-xs sm:text-sm" data-testid="designation-detail-content">
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

        {/* Career Progression Ladder */}
        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
            Career Hierarchy Band ({tier.shortLabel})
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {CAREER_LEVEL_BANDS.map((band) => {
              const isCurrent = Math.min(4, Math.max(1, designation.level)) === band.level;
              return (
                <div
                  key={band.level}
                  className={`p-2 rounded-tile border text-center transition-all ${
                    isCurrent
                      ? `${band.pillClass} shadow-sm scale-[1.02]`
                      : 'bg-surface-muted/50 border-border text-text-subtle'
                  }`}
                >
                  <div className="text-xs font-mono font-bold">L{band.level}</div>
                  <div className="text-[10px] truncate">{band.shortLabel}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Members Holding This Designation */}
        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
            Staff in this Role ({holders.length})
          </span>
          {holders.length === 0 ? (
            <p className="text-xs text-text-muted">No team members currently hold this role.</p>
          ) : (
            <div className="divide-y divide-border/70 border border-border rounded-tile bg-surface max-h-56 overflow-y-auto">
              {holders.map((emp) => {
                const fullName = `${emp.firstName} ${emp.lastName}`;
                return (
                  <a
                    key={emp.id}
                    href={`/employees/${emp.id}`}
                    className="w-full p-2.5 flex items-center justify-between gap-2 text-left hover:bg-surface-muted/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${getAvatarTone(
                          fullName,
                        )}`}
                      >
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text truncate">{fullName}</div>
                        <div className="text-[11px] text-text-muted truncate">
                          {emp.employeeCode} &middot; {emp.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant={emp.status === 'active' ? 'success' : 'neutral'}>
                      {emp.status === 'pending' ? 'Onboarding' : emp.status}
                    </Badge>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1 pb-3 border-b border-border">
          <span className="text-text-muted font-medium block text-xs">Designation ID</span>
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
