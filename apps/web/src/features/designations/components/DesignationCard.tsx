import type { Designation, DepartmentOption } from '../types';
import { Badge } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';

export interface DesignationCardProps {
  designation: Designation;
  departmentMap: Map<string, DepartmentOption>;
  canEdit: boolean;
  canDeactivate: boolean;
  onView: (designation: Designation) => void;
  onEdit: (designation: Designation) => void;
  onDeactivate: (designation: Designation) => void;
}

export function DesignationCard({
  designation,
  departmentMap,
  canEdit,
  canDeactivate,
  onView,
  onEdit,
  onDeactivate,
}: DesignationCardProps) {
  const dept = departmentMap.get(designation.departmentId);
  const departmentName = dept ? dept.name : 'Unknown Dept';

  const formattedDate = designation.createdAt
    ? new Date(designation.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card flex flex-col gap-3 transition-colors"
      data-testid={`designation-card-${designation.id}`}
    >
      {/* Header: Title, Code & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text truncate">{designation.title}</h3>
          <span className="font-mono text-xs text-text-muted">{designation.code}</span>
        </div>
        <Badge variant={designation.isActive ? 'success' : 'neutral'}>
          {designation.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Meta Grid: Department & Level */}
      <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-border py-2.5">
        <div>
          <span className="text-text-subtle block font-medium">Department</span>
          <span className="text-text font-semibold truncate block" title={departmentName}>
            {departmentName}
          </span>
        </div>
        <div>
          <span className="text-text-subtle block font-medium">Level</span>
          <span className="text-text font-semibold inline-flex items-center px-2 py-0.5 rounded bg-primary-soft text-primary-ink text-[11px] font-mono">
            Level {designation.level}
          </span>
        </div>
        <div className="col-span-2 pt-1 flex items-center justify-between text-text-muted">
          <span>Created:</span>
          <span className="text-text font-medium">{formattedDate}</span>
        </div>
      </div>

      {/* Actions Footer (Touch Targets >= 44x44px) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
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
