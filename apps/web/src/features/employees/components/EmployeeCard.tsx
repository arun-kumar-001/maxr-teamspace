import type { EmployeeDirectoryItem } from '../types';
import { Badge } from '../../../components/ui/StatusPill';

export interface EmployeeCardProps {
  employee: EmployeeDirectoryItem;
  canDeactivate?: boolean;
  onDeactivate?: (employee: EmployeeDirectoryItem) => void;
}

export function EmployeeCard({ employee, canDeactivate = false, onDeactivate }: EmployeeCardProps) {
  const initials = `${employee.firstName[0] || ''}${employee.lastName[0] || ''}`.toUpperCase();

  const statusVariant =
    employee.status === 'active'
      ? 'success'
      : employee.status === 'pending'
        ? 'warning'
        : 'neutral';

  const statusLabel = employee.status.charAt(0).toUpperCase() + employee.status.slice(1);

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card flex flex-col gap-3 transition-colors"
      data-testid={`employee-card-${employee.id}`}
    >
      {/* Top Header: Avatar, Name, Code, and Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center shrink-0 text-sm"
            aria-hidden="true"
          >
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <a
              href={`/employees/${employee.id}`}
              className="text-sm font-semibold text-text hover:text-primary-deep hover:underline truncate block"
            >
              {employee.firstName} {employee.lastName}
            </a>
            <span className="text-xs font-mono text-text-muted">{employee.employeeCode}</span>
          </div>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      {/* Middle Body: Department, Designation, Manager */}
      <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-border py-2.5">
        <div>
          <span className="text-text-subtle block font-medium">Department</span>
          <span className="text-text font-semibold truncate block">{employee.department.name}</span>
        </div>
        <div>
          <span className="text-text-subtle block font-medium">Designation</span>
          <span className="text-text font-semibold truncate block">
            {employee.designation.title}
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-text-subtle block font-medium">Reports To</span>
          <span className="text-text truncate block">
            {employee.manager
              ? `${employee.manager.firstName} ${employee.manager.lastName} (${employee.manager.employeeCode})`
              : '—'}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Joining Date and Contact Quick-Actions (Min 44px touch targets) */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-text-muted">
          Joined: <span className="font-medium text-text">{employee.joiningDate}</span>
        </span>

        <div className="flex items-center gap-2">
          {employee.email && (
            <a
              href={`mailto:${employee.email}`}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-2.5 py-1 text-xs font-medium text-primary-deep bg-primary-soft hover:bg-surface-muted rounded-input transition-colors focus:ring-2 focus:ring-primary-strong outline-none"
              aria-label={`Send email to ${employee.firstName} ${employee.lastName}`}
            >
              Email
            </a>
          )}
          {employee.phone && (
            <a
              href={`tel:${employee.phone}`}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-2.5 py-1 text-xs font-medium text-text bg-surface border border-border-strong hover:bg-surface-muted rounded-input transition-colors focus:ring-2 focus:ring-primary-strong outline-none"
              aria-label={`Call ${employee.firstName} ${employee.lastName}`}
            >
              Call
            </a>
          )}
          {canDeactivate && onDeactivate && employee.status !== 'deactivated' && (
            <button
              type="button"
              onClick={() => onDeactivate(employee)}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-input transition-colors focus:ring-2 focus:ring-rose-500 outline-none"
              aria-label={`Deactivate ${employee.firstName} ${employee.lastName}`}
              data-testid={`deactivate-btn-card-${employee.id}`}
            >
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
