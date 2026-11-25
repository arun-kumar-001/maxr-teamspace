import type { EmployeeProfile } from '../types';

export interface RecordPersonalInformationProps {
  profile: EmployeeProfile;
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
 * The Personal Information card of My Profile for somebody else's record: the same card, but only
 * what the employee record holds (name, code, email, phone). My Profile's nick name, gender,
 * country, language and time zone are not stored for anyone, so they are not shown here.
 */
export function RecordPersonalInformation({ profile }: RecordPersonalInformationProps) {
  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="record-personal-info-heading"
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
          <h2 id="record-personal-info-heading" className="text-base font-semibold text-text">
            Personal Information
          </h2>
          <p className="text-xs text-text-muted">Contact information on record.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" value={`${profile.firstName} ${profile.lastName}`.trim()} />
          <Field label="Employee Code" value={profile.employeeCode} mono />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Work Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
        </div>
      </div>
    </section>
  );
}
