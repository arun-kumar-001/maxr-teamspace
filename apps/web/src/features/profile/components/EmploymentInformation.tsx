import { Badge } from '../../../components/ui/StatusPill';
import type { EmployeeProfile } from '../types';

export interface EmploymentInformationProps {
  profile: EmployeeProfile;
}

export function EmploymentInformation({ profile }: EmploymentInformationProps) {
  const managerDisplayName = profile.manager
    ? `${profile.manager.firstName} ${profile.manager.lastName} (${profile.manager.employeeCode})`
    : 'None (Direct Report / Executive)';

  const formattedJoiningDate = (() => {
    try {
      const date = new Date(profile.joiningDate);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch {
      // fallback to raw string
    }
    return profile.joiningDate;
  })();

  const statusVariant =
    profile.status === 'active' ? 'success' : profile.status === 'pending' ? 'warning' : 'danger';

  const statusLabel =
    profile.status === 'active'
      ? 'Active'
      : profile.status === 'pending'
        ? 'Pending'
        : 'Deactivated';

  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="employment-info-heading"
      data-testid="employment-info-card"
    >
      <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
        <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-strong flex items-center justify-center">
          <svg
            className="w-4 h-4 stroke-current"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <div>
          <h2 id="employment-info-heading" className="text-base font-semibold text-text">
            Employment Details
          </h2>
          <p className="text-xs text-text-muted">
            Official company assignment records. Maintained by HR Administration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Employee Code */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Employee Code
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-mono font-medium text-text">
            {profile.employeeCode}
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Employment Status
          </span>
          <div className="p-2 bg-surface-muted border border-border rounded-input flex items-center min-h-[42px]">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
        </div>

        {/* Department */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Department
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
            <span>{profile.department.name}</span>
            <span className="ml-2 text-xs font-mono text-text-subtle">
              ({profile.department.code})
            </span>
          </div>
        </div>

        {/* Designation */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Designation
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
            <span>{profile.designation.title}</span>
            <span className="ml-2 text-xs font-mono text-text-subtle">
              ({profile.designation.code})
            </span>
          </div>
        </div>

        {/* Reporting Manager */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Reporting Manager
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
            {managerDisplayName}
          </div>
        </div>

        {/* Joining Date */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Joining Date
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
            {formattedJoiningDate}
          </div>
        </div>
      </div>
    </section>
  );
}
