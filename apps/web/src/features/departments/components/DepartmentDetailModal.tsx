import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/StatusPill';
import { getAvatarTone, getInitials } from '../../employees/components/hiringUtils';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { Designation } from '../../designations/types';
import type { Department } from '../types';

export interface DepartmentDetailModalProps {
  isOpen: boolean;
  department: Department | null;
  onClose: () => void;
  members?: EmployeeDirectoryItem[];
  designations?: Designation[];
  onNavigateEmployee?: (employeeId: string) => void;
}

export function DepartmentDetailModal({
  isOpen,
  department,
  onClose,
  members = [],
  designations = [],
  onNavigateEmployee,
}: DepartmentDetailModalProps) {
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

  const activeCount = members.filter((m) => m.status === 'active').length;
  const onboardingCount = members.filter((m) => m.status === 'pending').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Department Details"
      subtitle={`${department.name} (${department.code})`}
      position="drawer"
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
      <div className="space-y-5 text-xs sm:text-sm" data-testid="department-detail-content">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-text-muted font-medium">Status</span>
          <Badge variant={department.isActive ? 'success' : 'neutral'}>
            {department.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Summary KPI tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-tile bg-surface-muted/70 p-3">
            <div className="text-lg font-bold text-text">{activeCount}</div>
            <div className="text-[11px] text-text-muted">Active Staff</div>
          </div>
          <div className="rounded-tile bg-surface-muted/70 p-3">
            <div className="text-lg font-bold text-text">{onboardingCount}</div>
            <div className="text-[11px] text-text-muted">Onboarding</div>
          </div>
          <div className="rounded-tile bg-surface-muted/70 p-3">
            <div className="text-lg font-bold text-text">{designations.length}</div>
            <div className="text-[11px] text-text-muted">Designations</div>
          </div>
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

        {/* Designations in this Division */}
        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
            Aligned Designations ({designations.length})
          </span>
          {designations.length === 0 ? (
            <p className="text-xs text-text-muted">No designations assigned to this department.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {designations
                .slice()
                .sort((a, b) => b.level - a.level)
                .map((desig) => (
                  <span
                    key={desig.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted border border-border text-xs font-medium text-text"
                  >
                    <span>{desig.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary-soft text-primary-deep font-semibold">
                      L{desig.level}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Division Members Roster */}
        <div className="space-y-2 pb-3 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
            Team Members ({members.length})
          </span>
          {members.length === 0 ? (
            <p className="text-xs text-text-muted">No employees currently in this division.</p>
          ) : (
            <div className="divide-y divide-border/70 border border-border rounded-tile bg-surface max-h-60 overflow-y-auto">
              {members.map((emp) => {
                const fullName = `${emp.firstName} ${emp.lastName}`;
                return (
                  <a
                    key={emp.id}
                    href={`/employees/${emp.id}`}
                    onClick={(e) => {
                      if (onNavigateEmployee) {
                        e.preventDefault();
                        onNavigateEmployee(emp.id);
                      }
                    }}
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
                          {emp.designation?.title ?? emp.employeeCode}
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
          <span className="text-text-muted font-medium block text-xs">Department ID</span>
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
