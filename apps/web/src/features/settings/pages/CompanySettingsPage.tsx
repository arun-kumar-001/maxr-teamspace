import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Toast } from '../../../components/ui/Toast';
import { useSettings } from '../hooks/useSettings';
import { CompanyProfileSection } from '../components/CompanyProfileSection';
import { CompanyLogoSection } from '../components/CompanyLogoSection';
import { WorkingTimeSection } from '../components/WorkingTimeSection';
import { AttendanceSetupSection } from '../components/AttendanceSetupSection';
import { LeaveSetupSection } from '../components/LeaveSetupSection';
import { IntegrationsSection } from '../components/IntegrationsSection';
import { SecuritySettingsSection } from '../components/SecuritySettingsSection';
import { SystemHealthSection } from '../components/SystemHealthSection';
import { AdminProfilePhotoSection } from '../components/AdminProfilePhotoSection';

type SettingsTab = 'all' | 'branding' | 'schedule' | 'attendance' | 'leave' | 'integrations';

function IconGrid({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function IconBuilding({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCalendarCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconSliders({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}

const TABS: { id: SettingsTab; label: string; icon: (props: { className?: string }) => JSX.Element }[] = [
  { id: 'all', label: 'All Settings', icon: IconGrid },
  { id: 'branding', label: 'Identity & Logo', icon: IconBuilding },
  { id: 'schedule', label: 'Work Schedule', icon: IconClock },
  { id: 'attendance', label: 'Attendance Setup', icon: IconCalendarCheck },
  { id: 'leave', label: 'Leave Setup', icon: IconCalendar },
  { id: 'integrations', label: 'Integrations & System', icon: IconSliders },
];

export function CompanySettingsPage() {
  const { role, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const [showToast, setShowToast] = useState(false);
  const [photoToastMessage, setPhotoToastMessage] = useState<string | null>(null);

  const {
    draft,
    isLoading,
    isSaving,
    error,
    isDirty,
    hasWorkWeekError,
    workWeekErrorMessage,
    updateDraft,
    updateIntegrationToggle,
    saveSettings,
    resetDraft,
    refetch,
  } = useSettings();

  // Role Gate: Only System Administrators can access this configuration
  if (!authLoading && role !== ROLES.ADMIN) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <ForbiddenState
          title="Access Denied"
          message="You do not have permission to view or manage company settings. Only System Administrators can access this configuration."
        />
      </div>
    );
  }

  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      setShowToast(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-5 right-5 z-50">
          <Toast
            variant="success"
            title="Settings Saved"
            message="Company configuration, logo, work schedule, and policies updated successfully."
            autoDismissMs={4000}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}

      {photoToastMessage && (
        <div className="fixed top-5 right-5 z-50">
          <Toast
            variant="success"
            title="Notification"
            message={photoToastMessage}
            autoDismissMs={4000}
            onClose={() => setPhotoToastMessage(null)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">
            Company Configuration
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Global organization identity, company logo, work schedule, attendance &amp; leave setup, and platform integrations.
          </p>
        </div>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 self-start sm:self-auto shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            Unsaved Changes
          </span>
        )}
      </div>

      {/* Category Tab Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[38px] ${
                isActive
                  ? 'bg-primary-deep text-white shadow-sm ring-1 ring-primary-deep'
                  : 'bg-surface text-text-muted hover:text-text hover:bg-surface-raised border border-border'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-text-subtle'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-6" data-testid="settings-skeleton">
          <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
            <Skeleton variant="rectangular" height={24} width="30%" />
            <Skeleton variant="rectangular" height={44} />
          </div>
          <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
            <Skeleton variant="rectangular" height={24} width="30%" />
            <Skeleton variant="rectangular" height={44} />
          </div>
        </div>
      ) : error && !draft ? (
        <ErrorState title="Failed to Load Settings" message={error} onRetry={refetch} />
      ) : draft ? (
        <div className="space-y-6">
          {/* Save Error Banner if save failed */}
          {error && (
            <div
              className="p-4 bg-rose-50 border border-rose-200 rounded-tile text-sm text-rose-800 flex items-center justify-between gap-3"
              role="alert"
              data-testid="save-error-banner"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={resetDraft}
                className="text-xs text-rose-900 underline font-medium hover:text-rose-950 cursor-pointer"
              >
                Reset to last saved
              </button>
            </div>
          )}

          {/* Section: Branding & Identity */}
          {(activeTab === 'all' || activeTab === 'branding') && (
            <>
              <CompanyLogoSection
                companyName={draft.companyName}
                logoUrl={draft.companyLogo}
                onUpdateLogo={(newLogo) => updateDraft({ companyLogo: newLogo })}
                onNotify={(msg) => setPhotoToastMessage(msg)}
                disabled={isSaving}
              />

              <CompanyProfileSection draft={draft} onUpdate={updateDraft} disabled={isSaving} />

              <AdminProfilePhotoSection onNotify={(msg) => setPhotoToastMessage(msg)} />
            </>
          )}

          {/* Section: Work Schedule & Shift Timings */}
          {(activeTab === 'all' || activeTab === 'schedule') && (
            <WorkingTimeSection
              draft={draft}
              onUpdate={updateDraft}
              hasError={hasWorkWeekError}
              errorMessage={workWeekErrorMessage}
              disabled={isSaving}
            />
          )}

          {/* Section: Attendance Rules & Policies */}
          {(activeTab === 'all' || activeTab === 'attendance') && (
            <AttendanceSetupSection
              draft={draft}
              onUpdate={updateDraft}
              disabled={isSaving}
            />
          )}

          {/* Section: Leave Policy & Quotas */}
          {(activeTab === 'all' || activeTab === 'leave') && (
            <LeaveSetupSection
              draft={draft}
              onUpdate={updateDraft}
              disabled={isSaving}
            />
          )}

          {/* Section: Integrations & Security */}
          {(activeTab === 'all' || activeTab === 'integrations') && (
            <>
              <IntegrationsSection
                toggles={draft.integrations}
                onToggle={updateIntegrationToggle}
                disabled={isSaving}
              />

              <SecuritySettingsSection />

              <SystemHealthSection />
            </>
          )}

          {/* Sticky Action Footer */}
          <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface/95 backdrop-blur-sm border border-border rounded-card shadow-raised">
            <div className="text-xs text-text-muted">
              {isDirty ? (
                <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  You have unsaved changes. Remember to save before navigating away.
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-text-subtle">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  All configuration parameters are synced.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                disabled={!isDirty || isSaving}
                onClick={resetDraft}
                className="w-full sm:w-auto min-h-[44px]"
                data-testid="discard-changes-btn"
              >
                Discard Changes
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!isDirty || hasWorkWeekError || isSaving}
                isLoading={isSaving}
                onClick={handleSave}
                className="w-full sm:w-auto min-h-[44px]"
                data-testid="save-settings-btn"
              >
                {isSaving ? 'Saving Changes...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
