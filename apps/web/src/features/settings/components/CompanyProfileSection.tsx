import { useMemo } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useTimezones } from '../hooks/useTimezones';
import type { SettingsDraft } from '../hooks/useSettings';

interface CompanyProfileSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

export function CompanyProfileSection({
  draft,
  onUpdate,
  disabled = false,
}: CompanyProfileSectionProps) {
  const timezoneOptions = useTimezones();

  const currentTimeInTimezone = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: draft.timezone,
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date());
    } catch {
      return 'Invalid Timezone';
    }
  }, [draft.timezone]);

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5"
      data-testid="company-profile-section"
    >
      <div>
        <h3 className="text-base font-semibold text-text">Company Profile</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Primary organization details and default time configuration for timestamps and scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Company Legal Name" htmlFor="settings-company-name" required>
          <Input
            id="settings-company-name"
            name="companyName"
            value={draft.companyName}
            onChange={(e) => onUpdate({ companyName: e.target.value })}
            placeholder="e.g. MAXR Technologies"
            maxLength={255}
            disabled={disabled}
            data-testid="company-name-input"
          />
        </FormField>

        <FormField
          label="Primary IANA Timezone"
          htmlFor="settings-timezone"
          required
          helperText={`Current clock: ${currentTimeInTimezone}`}
        >
          <Select
            id="settings-timezone"
            name="timezone"
            value={draft.timezone}
            onChange={(e) => onUpdate({ timezone: e.target.value })}
            options={timezoneOptions}
            disabled={disabled}
            data-testid="company-timezone-select"
          />
        </FormField>
      </div>
    </div>
  );
}
