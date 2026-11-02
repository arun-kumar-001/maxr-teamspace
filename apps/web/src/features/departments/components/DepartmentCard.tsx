import type { Department } from '../types';
import { Badge } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';

export interface DepartmentCardProps {
  department: Department;
  canEdit: boolean;
  canDeactivate: boolean;
  onView: (department: Department) => void;
  onEdit: (department: Department) => void;
  onDeactivate: (department: Department) => void;
}

export function DepartmentCard({
  department,
  canEdit,
  canDeactivate,
  onView,
  onEdit,
  onDeactivate,
}: DepartmentCardProps) {
  const formattedDate = department.createdAt
    ? new Date(department.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card flex flex-col gap-3 transition-colors"
      data-testid={`department-card-${department.id}`}
    >
      {/* Header: Name, Code & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text truncate">{department.name}</h3>
          <span className="font-mono text-xs text-text-muted">{department.code}</span>
        </div>
        <Badge variant={department.isActive ? 'success' : 'neutral'}>
          {department.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Meta Body */}
      <div className="text-xs text-text-subtle border-t border-b border-border py-2 flex items-center justify-between">
        <span>Created:</span>
        <span className="font-medium text-text">{formattedDate}</span>
      </div>

      {/* Actions Footer (Touch Targets >= 44x44px) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
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

        {canDeactivate && department.isActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(department)}
            className="min-h-[44px] min-w-[44px] text-xs font-medium text-danger hover:bg-rose-50 flex-1 sm:flex-initial"
            data-testid={`card-deactivate-dept-${department.id}`}
          >
            Deactivate
          </Button>
        )}
      </div>
    </div>
  );
}
