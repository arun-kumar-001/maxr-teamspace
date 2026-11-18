import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import { getAvatarTone, getInitials } from '../../employees/components/hiringUtils';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { Designation } from '../../designations/types';
import type { Department } from '../types';

export interface DepartmentCardProps {
  department: Department;
  canEdit: boolean;
  canDeactivate: boolean;
  onView: (department: Department) => void;
  onEdit: (department: Department) => void;
  onDeactivate: (department: Department) => void;
  members?: EmployeeDirectoryItem[];
  designations?: Designation[];
  totalWorkforce?: number;
  animationIndex?: number;
}

export function DepartmentCard({
  department,
  canEdit,
  canDeactivate,
  onView,
  onEdit,
  onDeactivate,
  members = [],
  designations = [],
  totalWorkforce = 0,
  animationIndex = 0,
}: DepartmentCardProps) {
  const formattedDate = department.createdAt
    ? new Date(department.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const activeCount = members.filter((m) => m.status === 'active').length;
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const sharePct = totalWorkforce > 0 ? Math.round((members.length / totalWorkforce) * 100) : 0;

  const sortedMembers = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const visibleAvatars = sortedMembers.slice(0, 4);
  const extraCount = Math.max(0, members.length - visibleAvatars.length);

  return (
    <div
      onClick={() => onView(department)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(department);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ animationDelay: `${Math.min(animationIndex, 8) * 55}ms` }}
      className="group animate-crm-fade-up relative overflow-hidden p-4 bg-surface border border-border rounded-card shadow-card flex flex-col justify-between gap-3.5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-raised hover:border-primary-strong/40 cursor-pointer focus:outline-none focus:ring-0 outline-none"
      data-testid={`department-card-${department.id}`}
    >
      {/* Top Interactive Accent Strip */}
      <div
        className={`absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5 ${
          department.isActive ? 'bg-primary-strong' : 'bg-border-strong'
        }`}
      />

      {/* Header: Department name and status */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-bold text-text truncate group-hover:text-primary-deep transition-colors">
              {department.name}
            </h3>
          </div>
        </div>

        <Badge variant={department.isActive ? 'success' : 'neutral'}>
          <span className="inline-flex items-center gap-1.5">
            {department.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-positive-ink animate-pulse" />
            )}
            <span>{department.isActive ? 'Active' : 'Inactive'}</span>
          </span>
        </Badge>
      </div>

      {/* Workforce Stats & Animated Share Bar */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
            <div className="text-base font-bold text-text leading-tight">{members.length}</div>
            <div className="text-[11px] text-text-muted">members</div>
          </div>
          <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
            <div className="text-base font-bold text-text leading-tight">{designations.length}</div>
            <div className="text-[11px] text-text-muted">roles</div>
          </div>
          <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
            <div className="text-base font-bold text-text leading-tight">{activeCount}</div>
            <div className="text-[11px] text-text-muted">
              {pendingCount > 0 ? `+${pendingCount} onb.` : 'active'}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>Workforce share</span>
            <span className="font-semibold text-text">{sharePct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
            <div
              className={`h-full rounded-full animate-crm-bar ${
                department.isActive ? 'bg-primary-strong' : 'bg-border-strong'
              }`}
              style={{ width: `${Math.max(sharePct, members.length > 0 ? 8 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Avatars + Lead + Linked Designation Pills */}
      <div className="space-y-2 border-t border-b border-border py-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center -space-x-2">
            {visibleAvatars.length === 0 ? (
              <span className="text-text-subtle text-[11px]">No assigned staff yet</span>
            ) : (
              visibleAvatars.map((emp) => {
                const fullName = `${emp.firstName} ${emp.lastName}`;
                return (
                  <span
                    key={emp.id}
                    title={`${fullName}${emp.designation?.title ? ` · ${emp.designation.title}` : ''}`}
                    className={`w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-semibold transition-transform duration-200 hover:scale-110 hover:z-10 ${getAvatarTone(
                      fullName,
                    )}`}
                  >
                    {getInitials(emp.firstName, emp.lastName)}
                  </span>
                );
              })
            )}
            {extraCount > 0 && (
              <span className="w-7 h-7 rounded-full border-2 border-surface bg-surface-muted text-text-muted flex items-center justify-center text-[10px] font-semibold">
                +{extraCount}
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-muted truncate max-w-[140px]">
            {`Created ${formattedDate}`}
          </span>
        </div>

        {designations.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {designations.slice(0, 3).map((d) => (
              <span
                key={d.id}
                className="px-2 py-0.5 rounded-full bg-surface-muted text-text-muted text-[10px] font-medium truncate max-w-[130px]"
              >
                {d.title}
              </span>
            ))}
            {designations.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep text-[10px] font-semibold">
                +{designations.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer (Touch Targets >= 44x44px) */}
      <div
        className="flex items-center gap-2 flex-wrap"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onView(department)}
          className="min-h-[44px] min-w-[44px] text-xs font-medium flex-1 sm:flex-initial"
          data-testid={`card-view-dept-${department.id}`}
        >
          View
        </Button>

        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(department)}
            className="min-h-[44px] min-w-[44px] text-xs font-medium flex-1 sm:flex-initial"
            data-testid={`card-edit-dept-${department.id}`}
          >
            Edit
          </Button>
        )}

        {canDeactivate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(department)}
            className="min-h-[44px] min-w-[44px] text-xs font-semibold text-danger hover:bg-rose-50 flex-1 sm:flex-initial inline-flex items-center gap-1.5 ml-auto"
            data-testid={`card-deactivate-dept-${department.id}`}
            aria-label={`Deactivate or delete department ${department.name}`}
          >
            <svg
              className="w-4 h-4 shrink-0 text-danger"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}
