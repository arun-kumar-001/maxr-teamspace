import { useContext, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { AuthContext } from '../../../auth/AuthContext';
import { Badge } from '../../../components/ui/StatusPill';
import { deleteMyPhoto, uploadMyPhoto } from '../api/profileApi';
import type { EmployeeProfile } from '../types';

export interface ProfileHeaderProps {
  profile: EmployeeProfile;
  /**
   * Shows somebody else's profile (the Employee Directory): this avatar replaces the signed-in
   * user's photo and the upload camera, and the header gets no link to itself.
   */
  avatar?: ReactNode;
  /** Buttons shown at the right of the header, for example Edit and Deactivate. */
  actions?: ReactNode;
}

export function ProfileHeader({ profile, avatar, actions }: ProfileHeaderProps) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const updateUserAvatar = auth?.updateUserAvatar;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const initials =
    `${profile.firstName.charAt(0) || ''}${profile.lastName.charAt(0) || ''}`.toUpperCase() || 'U';

  const statusVariant =
    profile.status === 'active' ? 'success' : profile.status === 'pending' ? 'warning' : 'danger';

  const statusLabel =
    profile.status === 'active'
      ? 'Active'
      : profile.status === 'pending'
        ? 'Pending Verification'
        : 'Deactivated';

  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    uploadMyPhoto(file)
      .then((photoUrl) => updateUserAvatar?.(photoUrl))
      .catch((err: unknown) =>
        setUploadError(err instanceof Error ? err.message : 'The photo could not be saved.'),
      );
  };

  const handleRemovePhoto = () => {
    setUploadError(null);
    deleteMyPhoto()
      .then(() => updateUserAvatar?.(null))
      .catch((err: unknown) =>
        setUploadError(err instanceof Error ? err.message : 'The photo could not be removed.'),
      );
  };

  return (
    <div
      className="bg-surface border border-border rounded-card overflow-hidden shadow-card"
      data-testid="profile-header"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFileChange}
        className="hidden"
        data-testid="profile-photo-file-input"
        aria-label="Upload profile photo"
      />

      {/* Decorative Soft Pastel Banner matching Image 1 reference */}
      <div className="h-28 sm:h-32 bg-gradient-to-r from-teal-100/60 via-sky-50/50 to-amber-100/50 relative border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(#46C7B8_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
      </div>

      <div className="px-6 pb-6 pt-0 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
          <div className="flex items-end gap-4 min-w-0">
            {avatar ? (
              <div className="relative shrink-0" data-testid="profile-avatar-initials">
                {avatar}
              </div>
            ) : (
              <div className="relative group/avatar shrink-0">
                <div
                  onClick={handleChoosePhoto}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-surface text-primary-ink font-display font-bold text-2xl sm:text-3xl flex items-center justify-center border-4 border-surface shadow-md overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary-strong hover:opacity-95"
                  aria-label="Click to upload profile photo"
                  title="Click to change profile photo"
                  data-testid="profile-avatar-initials"
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={profile.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full bg-primary-soft flex items-center justify-center">
                      {initials}
                    </span>
                  )}
                </div>

                {/* Camera Icon Overlay */}
                <button
                  type="button"
                  onClick={handleChoosePhoto}
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
              </div>
            )}

            {/* Profile Name & Designation / Department */}
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

          {/* Quick Actions (Right aligned) */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end pt-2 sm:pt-0">
            {profile.status === 'deactivated' && (
              <div
                className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-input text-xs text-rose-800"
                role="alert"
              >
                <strong>Account Deactivated:</strong> This profile is read-only.
              </div>
            )}

            {avatar ? (
              actions
            ) : (
              <a
                href={`/employees/${profile.id}`}
                data-testid="view-full-record-link"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-input border border-border bg-surface hover:bg-surface-muted text-text transition-colors shadow-xs min-h-[44px]"
              >
                <svg
                  className="w-3.5 h-3.5 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span>View Full Record</span>
              </a>
            )}
          </div>
        </div>

        {/* Sub-strip with employee code and version */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/60 text-xs text-text-muted flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-surface-muted text-text-muted border border-border">
            {profile.employeeCode}
          </span>
          <span className="text-xs text-text-subtle font-mono">Version {profile.version}</span>
          {!avatar && user?.avatarUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-[11px] text-rose-600 hover:text-rose-800 hover:underline font-medium"
            >
              Remove Photo
            </button>
          )}
        </div>
        {uploadError && <p className="text-xs text-rose-600 mt-2">{uploadError}</p>}
      </div>
    </div>
  );
}
