import { useState } from 'react';
import type { EmployeeDirectoryItem } from '../types';
import { Badge } from '../../../components/ui/StatusPill';

export interface EmployeeCardProps {
  employee: EmployeeDirectoryItem;
  photoUrl?: string;
  canDeactivate?: boolean;
  onDeactivate?: (employee: EmployeeDirectoryItem) => void;
  onViewDetails?: (employee: EmployeeDirectoryItem) => void;
}

export function EmployeeCard({
  employee,
  photoUrl,
  canDeactivate = false,
  onDeactivate,
  onViewDetails,
}: EmployeeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = `${employee.firstName[0] || ''}${employee.lastName[0] || ''}`.toUpperCase();

  const photo =
    photoUrl ||
    (employee as unknown as { avatarUrl?: string }).avatarUrl ||
    (typeof window !== 'undefined' && window.localStorage
      ? localStorage.getItem(`maxr_avatar_${employee.id}`) ||
        ((employee as unknown as { userId?: string }).userId
          ? localStorage.getItem(
              `maxr_avatar_${(employee as unknown as { userId: string }).userId}`,
            )
          : null) ||
        (employee.email
          ? localStorage.getItem(`maxr_avatar_${employee.email.toLowerCase()}`)
          : null)
      : null);

  const statusVariant =
    employee.status === 'active'
      ? 'success'
      : employee.status === 'pending'
        ? 'warning'
        : 'neutral';

  const statusLabel = employee.status.charAt(0).toUpperCase() + employee.status.slice(1);

  // Deterministic activity percentage based on employee ID (matching Image 2 mockup ratios)
  const hash = employee.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const percentages = [100, 82, 66, 100, 33, 48, 75, 90];
  const progressPercent =
    employee.status === 'active' ? (percentages[hash % percentages.length] ?? 82) : 33;
  const activeSegments = progressPercent >= 100 ? 3 : progressPercent >= 66 ? 2 : 1;

  return (
    <div
      className="p-5 bg-surface border border-border/80 rounded-card shadow-card hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative group"
      data-testid={`employee-card-${employee.id}`}
    >
      {/* Top Header Bar: 3-Dots Action Menu */}
      <div className="flex items-center justify-between w-full mb-1">
        <Badge variant={statusVariant} className="text-[11px] opacity-80">
          {statusLabel}
        </Badge>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={`Actions for ${employee.firstName} ${employee.lastName}`}
            className="p-1.5 text-text-muted hover:text-text rounded-full hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {/* Quick Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-40 bg-surface border border-border rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95">
              <a
                href={`/employees/${employee.id}`}
                onClick={(e) => {
                  if (onViewDetails) {
                    e.preventDefault();
                    onViewDetails(employee);
                  }
                  setMenuOpen(false);
                }}
                className="block px-3 py-1.5 text-xs text-text hover:bg-primary-soft hover:text-primary-deep font-medium"
              >
                View Profile
              </a>
              {employee.email && (
                <a
                  href={`mailto:${employee.email}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs text-text hover:bg-primary-soft hover:text-primary-deep"
                >
                  Send Email
                </a>
              )}
              {employee.phone && (
                <a
                  href={`tel:${employee.phone}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs text-text hover:bg-primary-soft hover:text-primary-deep"
                >
                  Call Phone
                </a>
              )}
              {canDeactivate && onDeactivate && employee.status !== 'deactivated' && (
                <button
                  type="button"
                  onClick={() => {
                    onDeactivate(employee);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 font-medium"
                  data-testid={`deactivate-btn-card-${employee.id}`}
                >
                  Deactivate
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Centered Avatar with Status Indicator Ring (Image 2 Template) */}
      <div className="flex flex-col items-center text-center mt-1">
        <div className="relative">
          <div
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-primary-soft to-surface-muted text-primary-deep font-display font-bold text-xl flex items-center justify-center border-2 border-primary-strong/20 shadow-xs overflow-hidden relative"
            aria-hidden="true"
          >
            {photo ? (
              <img
                src={photo}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <span className={photo ? 'sr-only' : undefined}>{initials || '?'}</span>
          </div>

          {/* Status Indicator Dot on Avatar Ring (Image 2 Reference) */}
          <span
            className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-surface ${
              employee.status === 'active'
                ? 'bg-emerald-500'
                : employee.status === 'pending'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
            }`}
            title={statusLabel}
          />
        </div>

        {/* Centered Name and Email */}
        <a
          href={`/employees/${employee.id}`}
          onClick={(e) => {
            if (onViewDetails) {
              e.preventDefault();
              onViewDetails(employee);
            }
          }}
          className="text-base font-bold font-display text-text hover:text-primary-deep hover:underline truncate max-w-[200px] mt-3 block"
          data-testid={`employee-card-link-${employee.id}`}
        >
          {employee.firstName} {employee.lastName}
        </a>

        <p className="text-xs text-text-muted truncate max-w-[220px] mt-0.5">
          {employee.email || '—'}
        </p>

        <span className="text-[11px] font-mono text-text-subtle mt-0.5">
          {employee.employeeCode}
        </span>

        {/* Centered Segmented Progress / Activity Bar (Image 2 Reference) */}
        <div className="flex items-center gap-2 mt-4 px-3 py-1 bg-surface-muted/50 rounded-full border border-border/50">
          <div className="w-3.5 h-3.5 rounded-full border border-primary-strong/60 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-strong" />
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`h-1.5 w-6 rounded-full transition-colors ${
                activeSegments >= 1 ? 'bg-primary-deep' : 'bg-border-strong'
              }`}
            />
            <span
              className={`h-1.5 w-6 rounded-full transition-colors ${
                activeSegments >= 2 ? 'bg-primary-deep' : 'bg-border-strong'
              }`}
            />
            <span
              className={`h-1.5 w-6 rounded-full transition-colors ${
                activeSegments >= 3 ? 'bg-primary-deep' : 'bg-border-strong'
              }`}
            />
          </div>

          <span className="text-[11px] font-semibold text-text-muted ml-0.5">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Accessible Contact Touch Targets (Min 44px - Required for compliance & tests) */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border/70">
        {employee.email && (
          <a
            href={`mailto:${employee.email}`}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1.5 text-xs font-semibold text-primary-deep bg-primary-soft hover:bg-surface-muted rounded-input transition-colors focus:ring-2 focus:ring-primary-strong outline-none"
            aria-label={`Send email to ${employee.firstName} ${employee.lastName}`}
          >
            Email
          </a>
        )}
        {employee.phone && (
          <a
            href={`tel:${employee.phone}`}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1.5 text-xs font-semibold text-text bg-surface border border-border-strong hover:bg-surface-muted rounded-input transition-colors focus:ring-2 focus:ring-primary-strong outline-none"
            aria-label={`Call ${employee.firstName} ${employee.lastName}`}
          >
            Call
          </a>
        )}
        <a
          href={`/employees/${employee.id}`}
          onClick={(e) => {
            if (onViewDetails) {
              e.preventDefault();
              onViewDetails(employee);
            }
          }}
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text bg-surface-muted hover:bg-border/60 rounded-input transition-colors"
        >
          Details
        </a>
        {canDeactivate && onDeactivate && employee.status !== 'deactivated' && (
          <button
            type="button"
            onClick={() => onDeactivate(employee)}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-input transition-colors focus:ring-2 focus:ring-rose-500 outline-none"
            aria-label={`Deactivate ${employee.firstName} ${employee.lastName}`}
            data-testid={`deactivate-btn-card-${employee.id}`}
          >
            Deactivate
          </button>
        )}
      </div>

      {/* Bottom Full-Width Strip: Uppercase Designation & Department (Image 2 Template) */}
      <div className="pt-3 mt-2 border-t border-border/70 text-center">
        <span className="text-[11px] font-bold tracking-widest text-text-subtle uppercase block truncate">
          {employee.designation?.title || 'STAFF'}
        </span>
        {employee.department?.name && (
          <span className="text-[11px] text-text-muted block truncate mt-0.5">
            {employee.department.name}
          </span>
        )}
      </div>
    </div>
  );
}
