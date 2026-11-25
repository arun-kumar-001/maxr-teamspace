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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-text-subtle mb-1.5">{label}</span>
      <div
        className={`p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Only what the employee record holds: name, code and work email are read-only here (HR maintains
 * them); the phone is the one thing the employee edits. Nothing is shown that is not stored.
 */
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" value={`${profile.firstName} ${profile.lastName}`.trim()} />
          <Field label="Employee Code" value={profile.employeeCode} mono />
        </div>
        <Field label="Work Email" value={profile.email} />

        <div className="border-t border-border pt-4">
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
