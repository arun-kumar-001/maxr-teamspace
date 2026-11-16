import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import { getAvatarTone, getInitials } from '../../employees/components/hiringUtils';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { DepartmentOption, Designation } from '../types';
import { getLevelTierMeta } from './levelMeta';

export interface DesignationCardProps {
  designation: Designation;
  departmentMap: Map<string, DepartmentOption>;
  canEdit: boolean;
  canDeactivate: boolean;
  onView: (designation: Designation) => void;
  onEdit: (designation: Designation) => void;
  onDeactivate: (designation: Designation) => void;
  holders?: EmployeeDirectoryItem[];
  animationIndex?: number;
}

export function DesignationCard({
  designation,
  departmentMap,
  canEdit,
  canDeactivate,
  onView,
  onEdit,
  onDeactivate,
  holders = [],
  animationIndex = 0,
}: DesignationCardProps) {
  const dept = departmentMap.get(designation.departmentId);
  const departmentName = dept ? dept.name : 'Unknown Dept';
  const tier = getLevelTierMeta(designation.level);
  const clampedLevel = Math.min(4, Math.max(1, designation.level));
  const visibleHolders = holders.slice(0, 3);
  const extraHolders = Math.max(0, holders.length - visibleHolders.length);

  return (
    <div
      onClick={() => onView(designation)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(designation);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ animationDelay: `${Math.min(animationIndex, 8) * 50}ms` }}
      className="group animate-crm-fade-up relative overflow-hidden p-4 bg-surface border border-border rounded-card shadow-card flex flex-col justify-between gap-3 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-raised hover:border-primary-strong/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong"
      data-testid={`designation-card-${designation.id}`}
    >
      {/* Top Interactive Accent */}
      <div
        className={`absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5 ${
          designation.isActive ? tier.barClass : 'bg-border-strong'
        }`}
      />

      {/* Header: Department Pill & Status */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-muted text-text-muted text-[11px] font-medium truncate max-w-[150px]"
          title={departmentName}
        >
          {departmentName}
        </span>

        <Badge variant={designation.isActive ? 'success' : 'neutral'}>
          <span className="inline-flex items-center gap-1.5">
            {designation.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-positive-ink animate-pulse" />
            )}
            <span>{designation.isActive ? 'Active' : 'Inactive'}</span>
          </span>
        </Badge>
      </div>

      {/* Title, Code & Career Band */}
      <div>
        <h3 className="text-sm sm:text-base font-bold text-text truncate group-hover:text-primary-deep transition-colors">
          {designation.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-muted border border-border text-text-muted">
            {designation.code}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold font-mono ${tier.pillClass}`}
          >
            Level {designation.level}
          </span>
          <span className="text-[11px] text-text-subtle">{tier.shortLabel}</span>
        </div>
      </div>

      {/* 4-Step Animated Seniority Meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Hierarchy Band</span>
          <span className="font-medium text-text">Tier {designation.level} / 4</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-colors duration-300 ${
                step <= clampedLevel ? `${tier.barClass} animate-crm-bar` : 'bg-surface-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Assigned Staff Preview */}
      <div className="flex items-center justify-between gap-2 border-t border-b border-border py-2.5 text-xs">
        <div className="flex items-center -space-x-2">
          {visibleHolders.length === 0 ? (
            <span className="text-[11px] text-text-subtle">0 team members assigned</span>
          ) : (
            visibleHolders.map((emp) => {
              const fullName = `${emp.firstName} ${emp.lastName}`;
              return (
                <span
                  key={emp.id}
                  title={fullName}
                  className={`w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-semibold transition-transform duration-200 hover:scale-110 hover:z-10 ${getAvatarTone(
                    fullName,
                  )}`}
                >
                  {getInitials(emp.firstName, emp.lastName)}
                </span>
              );
            })
          )}
          {extraHolders > 0 && (
            <span className="w-7 h-7 rounded-full border-2 border-surface bg-surface-muted text-text-muted flex items-center justify-center text-[10px] font-semibold">
              +{extraHolders}
            </span>
          )}
        </div>

        <span className="text-[11px] font-semibold text-text-muted shrink-0">
          {holders.length} {holders.length === 1 ? 'staff' : 'staffs'}
        </span>
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
          onClick={() => onView(designation)}
          className="min-h-[44px] min-w-[44px] text-xs font-medium flex-1 sm:flex-initial"
          data-testid={`card-view-desig-${designation.id}`}
        >
          View
        </Button>

        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(designation)}
            className="min-h-[44px] min-w-[44px] text-xs font-medium flex-1 sm:flex-initial"
            data-testid={`card-edit-desig-${designation.id}`}
          >
            Edit
          </Button>
        )}

        {canDeactivate && designation.isActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(designation)}
            className="min-h-[44px] min-w-[44px] text-xs font-medium text-danger hover:bg-rose-50 flex-1 sm:flex-initial"
            data-testid={`card-deactivate-desig-${designation.id}`}
          >
            Deactivate
          </Button>
        )}
      </div>
    </div>
  );
}
