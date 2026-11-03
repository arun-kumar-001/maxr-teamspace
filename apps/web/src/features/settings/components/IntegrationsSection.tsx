import type { IntegrationToggles } from '../types';

interface IntegrationsSectionProps {
  toggles: IntegrationToggles;
  onToggle: (key: keyof IntegrationToggles, value: boolean) => void;
  disabled?: boolean;
}

interface IntegrationCardConfig {
  key: keyof IntegrationToggles;
  title: string;
  description: string;
  icon: string;
}

const INTEGRATION_ITEMS: IntegrationCardConfig[] = [
  {
    key: 'email',
    title: 'Email Notifications',
    description:
      'Dispatch transactional emails for onboarding invites, approvals, and reminders via SMTP/SendGrid.',
    icon: 'mail',
  },
  {
    key: 'sms',
    title: 'SMS Alerts',
    description:
      'Send high-urgency notifications and security verifications directly to employee phone numbers.',
    icon: 'message',
  },
  {
    key: 'calendarSync',
    title: 'Calendar Synchronization',
    description:
      'Sync official company holidays, team leave events, and scheduled meetings with external calendars.',
    icon: 'calendar',
  },
  {
    key: 'payrollExport',
    title: 'Payroll Export',
    description:
      'Enable automated end-of-month attendance summary and leave balances export to payroll platforms.',
    icon: 'file-text',
  },
];

export function IntegrationsSection({
  toggles,
  onToggle,
  disabled = false,
}: IntegrationsSectionProps) {
  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5"
      data-testid="integrations-section"
    >
      <div>
        <h3 className="text-base font-semibold text-text">Platform Integrations</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Enable or disable automated adapters for third-party communication, scheduling, and
          payroll feeds.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INTEGRATION_ITEMS.map((item) => {
          const isEnabled = toggles[item.key];
          return (
            <div
              key={item.key}
              className={`p-4 rounded-tile border transition-all flex items-start justify-between gap-4 ${
                isEnabled
                  ? 'bg-surface-raised border-primary-strong/30 shadow-card'
                  : 'bg-surface-muted/50 border-border opacity-75'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text truncate">{item.title}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                      isEnabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-surface-muted text-text-subtle border border-border'
                    }`}
                  >
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              {/* Accessible Toggle Button */}
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                disabled={disabled}
                onClick={() => onToggle(item.key, !isEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-strong focus:ring-offset-2 ${
                  isEnabled ? 'bg-primary-deep' : 'bg-border-strong'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                data-testid={`toggle-${item.key}`}
              >
                <span className="sr-only">Toggle {item.title}</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    isEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
