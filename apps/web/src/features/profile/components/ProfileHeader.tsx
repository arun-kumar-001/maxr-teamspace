import { Badge } from '../../../components/ui/StatusPill';
import type { EmployeeProfile } from '../types';

export interface ProfileHeaderProps {
  profile: EmployeeProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const initials =
    `${profile.firstName.charAt(0) || ''}${profile.lastName.charAt(0) || ''}`.toUpperCase();

  const statusVariant =
    profile.status === 'active' ? 'success' : profile.status === 'pending' ? 'warning' : 'danger';

  const statusLabel =
    profile.status === 'active'
      ? 'Active'
      : profile.status === 'pending'
        ? 'Pending Verification'
        : 'Deactivated';

  return (
    <div
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      data-testid="profile-header"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5 min-w-0">
          {/* Avatar Placeholder */}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-soft text-primary-ink font-display font-bold text-2xl flex items-center justify-center shrink-0 border-2 border-primary-strong/20 shadow-sm"
            aria-hidden="true"
            data-testid="profile-avatar-initials"
          >
            {initials}
          </div>

          {/* Name & Titles */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold font-display text-text truncate">
                {profile.firstName} {profile.lastName}
              </h1>
              <Badge variant={statusVariant} className="text-xs">
                {statusLabel}
              </Badge>
            </div>

            <p className="text-sm font-medium text-text-muted truncate">
              {profile.designation.title} &middot;{' '}
              <span className="text-text">{profile.department.name}</span>
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-surface-muted text-text-muted border border-border">
                {profile.employeeCode}
              </span>
              <span className="text-xs text-text-subtle font-mono">Version {profile.version}</span>
            </div>
          </div>
        </div>

        {/* Quick status banner for deactivated accounts */}
        {profile.status === 'deactivated' && (
          <div
            className="w-full sm:w-auto px-4 py-2 bg-rose-50 border border-rose-200 rounded-input text-xs text-rose-800"
            role="alert"
          >
            <strong>Account Deactivated:</strong> This profile is read-only.
          </div>
        )}
      </div>
    </div>
  );
}
