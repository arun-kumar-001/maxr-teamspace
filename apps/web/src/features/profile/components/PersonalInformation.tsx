import type { EmployeeProfile } from '../types';
import { PhoneEditor } from './PhoneEditor';

/** What lets the employee edit their own phone; present only when they are looking at themselves. */
export interface PhoneEditState {
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

export interface PersonalInformationProps {
  profile: EmployeeProfile;
  /** Given for your own profile (the phone is yours to edit); left out for anyone else's. */
  phone?: PhoneEditState;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-text-subtle mb-1.5">{label}</span>
      <div
        className={`p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value || <span className="text-text-muted font-normal">Not provided</span>}
      </div>
    </div>
  );
}

/**
 * Only what the employee record holds: name, code and work email are read-only here (HR maintains
 * them). The phone is the one thing the employee edits on their own profile; on anyone else's it
 * is shown like the rest. Nothing is shown that is not stored.
 */
export function PersonalInformation({ profile, phone }: PersonalInformationProps) {
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
            {phone
              ? 'Your contact information on record. Phone is self-editable.'
              : 'Contact information on record.'}
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
          {phone ? (
            <PhoneEditor
              currentPhone={profile.phone}
              phoneDraft={phone.phoneDraft}
              isEditing={phone.isEditingPhone}
              isSaving={phone.isSavingPhone}
              isDeactivated={profile.status === 'deactivated'}
              saveError={phone.saveError}
              conflictWarning={phone.conflictWarning}
              onDraftChange={phone.onDraftChange}
              onStartEdit={phone.onStartEditPhone}
              onCancelEdit={phone.onCancelEditPhone}
              onSave={phone.onSavePhone}
            />
          ) : (
            <Field label="Phone" value={profile.phone} />
          )}
        </div>
      </div>
    </section>
  );
}
