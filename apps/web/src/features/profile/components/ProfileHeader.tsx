import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/StatusPill';
import type { EmployeeProfile } from '../types';

export interface ProfileHeaderProps {
  profile: EmployeeProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  let navigate: (to: string) => void = () => {};
  try {
    navigate = useNavigate();
  } catch {
    // Fallback when rendered outside Router in isolated tests
  }

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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 self-stretch sm:self-auto">
          {/* Direct link to user's full employee record (Issue #155) */}
          <button
            type="button"
            onClick={() => navigate(`/employees/${profile.id}`)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-primary-deep bg-primary-soft hover:bg-primary-soft/80 border border-primary-strong/20 rounded-input transition-colors focus:ring-2 focus:ring-primary-strong outline-none min-h-[44px] shadow-sm cursor-pointer"
            data-testid="view-full-record-link"
            aria-label="View Full Employee Record"
          >
            <svg
              className="w-4 h-4 stroke-current shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            View Full Record
          </button>

          {/* Quick status banner for deactivated accounts */}
          {profile.status === 'deactivated' && (
            <div
              className="px-4 py-2 bg-rose-50 border border-rose-200 rounded-input text-xs text-rose-800 flex items-center justify-center min-h-[44px]"
              role="alert"
            >
              <strong>Account Deactivated:</strong> This profile is read-only.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
