import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Badge } from '../../../components/ui/StatusPill';
import { EmployeeAvatar } from '../../employees/components/EmployeeAvatar';
import type { EmployeeProfile } from '../types';

/** What changes the photo of the person shown. Given only to someone who may change it. */
export interface PhotoControls {
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

export interface ProfileHeaderProps {
  profile: EmployeeProfile;
  /** Given when the viewer may change this person's photo (their own, or Admin/HR for anyone). */
  photo?: PhotoControls;
  /** Buttons shown at the right of the header, for example Edit and Deactivate. */
  actions?: ReactNode;
}

/** The header every employee profile has: photo, name, status, role, code and version. */
export function ProfileHeader({ profile, photo, actions }: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const statusVariant =
    profile.status === 'active' ? 'success' : profile.status === 'pending' ? 'warning' : 'danger';

  const statusLabel =
    profile.status === 'active'
      ? 'Active'
      : profile.status === 'pending'
        ? 'Pending Verification'
        : 'Deactivated';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !photo) return;
    photo
      .onUpload(file)
      .catch((err: unknown) =>
        setPhotoError(err instanceof Error ? err.message : 'The photo could not be saved.'),
      );
  };

  const handleRemove = () => {
    setPhotoError(null);
    photo
      ?.onRemove()
      .catch((err: unknown) =>
        setPhotoError(err instanceof Error ? err.message : 'The photo could not be removed.'),
      );
  };

  return (
    <div
      className="bg-surface border border-border rounded-card overflow-hidden shadow-card"
      data-testid="profile-header"
    >
      {photo && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
          className="hidden"
          data-testid="profile-photo-file-input"
          aria-label="Upload profile photo"
        />
      )}

      {/* Decorative soft pastel banner */}
      <div className="h-28 sm:h-32 bg-gradient-to-r from-teal-100/60 via-sky-50/50 to-amber-100/50 relative border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(#46C7B8_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
      </div>

      <div className="px-6 pb-6 pt-0 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
          <div className="flex items-end gap-4 min-w-0">
            <div className="relative shrink-0" data-testid="profile-avatar-initials">
              <EmployeeAvatar
                name={`${profile.firstName} ${profile.lastName}`}
                employeeId={profile.id}
                photoUrl={profile.photoUrl}
                decorative
                className="h-20 w-20 border-4 border-surface bg-primary-soft font-display text-2xl font-bold text-primary-ink shadow-md sm:h-24 sm:w-24 sm:text-3xl"
              />
              {photo && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-surface-raised border border-border text-text shadow-sm flex items-center justify-center hover:bg-primary-soft hover:text-primary-strong hover:border-primary-strong transition-all cursor-pointer"
                  title="Upload profile photo"
                  aria-label="Upload profile photo"
                  data-testid="upload-avatar-btn"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Name, status, designation and department */}
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-text truncate">
                  {profile.firstName} {profile.lastName}
                </h1>
                <Badge variant={statusVariant} className="text-xs">
                  {statusLabel}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm font-medium text-text-muted truncate">
                {profile.designation.title} &middot;{' '}
                <span className="text-text">{profile.department.name}</span>
              </p>
            </div>
          </div>

          {/* Actions the viewer may take (right aligned) */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto justify-end pt-2 sm:pt-0">
            {profile.status === 'deactivated' && (
              <div
                className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-input text-xs text-rose-800"
                role="alert"
              >
                <strong>Account Deactivated:</strong> This profile is read-only.
              </div>
            )}
            {actions}
          </div>
        </div>

        {/* Sub-strip with employee code and version */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/60 text-xs text-text-muted flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-surface-muted text-text-muted border border-border">
            {profile.employeeCode}
          </span>
          <span className="text-xs text-text-subtle font-mono">Version {profile.version}</span>
          {photo && profile.photoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-[11px] text-rose-600 hover:text-rose-800 hover:underline font-medium"
            >
              Remove Photo
            </button>
          )}
        </div>
        {photoError && <p className="text-xs text-rose-600 mt-2">{photoError}</p>}
      </div>
    </div>
  );
}
