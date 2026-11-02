import type { EmployeeProfile } from '../types';
import { PhoneEditor } from './PhoneEditor';

export interface PersonalInformationProps {
  profile: EmployeeProfile;
  phoneDraft: string;
  isEditingPhone: boolean;
  isSavingPhone: boolean;
  saveError: string | null;
  conflictWarning: string | null;
  onDraftChange: (value: string) => void;
  onStartEditPhone: () => void;
  onCancelEditPhone: () => void;
  onSavePhone: () => void;
}

export function PersonalInformation({
  profile,
  phoneDraft,
  isEditingPhone,
  isSavingPhone,
  saveError,
  conflictWarning,
  onDraftChange,
  onStartEditPhone,
  onCancelEditPhone,
  onSavePhone,
}: PersonalInformationProps) {
  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="personal-info-heading"
      data-testid="personal-info-card"
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
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 id="personal-info-heading" className="text-base font-semibold text-text">
            Personal Information
          </h2>
          <p className="text-xs text-text-muted">
            Your contact information on record. Phone is self-editable.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Name Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
              First Name
            </span>
            <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
              {profile.firstName}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
              Last Name
            </span>
            <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
              {profile.lastName}
            </div>
          </div>
        </div>

        {/* Official Email */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Email Address
          </span>
          <div className="flex items-center gap-2 p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text font-mono truncate">
            <svg
              className="w-4 h-4 text-text-subtle shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 7L2 7" />
            </svg>
            <span className="truncate">{profile.email}</span>
          </div>
        </div>

        {/* Phone Section (Editable) */}
        <div className="border-t border-border pt-3">
          <PhoneEditor
            currentPhone={profile.phone}
            phoneDraft={phoneDraft}
            isEditing={isEditingPhone}
            isSaving={isSavingPhone}
            isDeactivated={profile.status === 'deactivated'}
            saveError={saveError}
            conflictWarning={conflictWarning}
            onDraftChange={onDraftChange}
            onStartEdit={onStartEditPhone}
            onCancelEdit={onCancelEditPhone}
            onSave={onSavePhone}
          />
        </div>
      </div>
    </section>
  );
}
