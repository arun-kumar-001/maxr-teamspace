import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Toast } from '../../../components/ui/Toast';
import { useSettings } from '../hooks/useSettings';
import { CompanyProfileSection } from '../components/CompanyProfileSection';
import { WorkWeekSection } from '../components/WorkWeekSection';
import { IntegrationsSection } from '../components/IntegrationsSection';
import { SecuritySettingsSection } from '../components/SecuritySettingsSection';
import { SystemHealthSection } from '../components/SystemHealthSection';
import { AdminProfilePhotoSection } from '../components/AdminProfilePhotoSection';

export function CompanySettingsPage() {
  const { role, isLoading: authLoading } = useAuth();
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

  // Role Gate: Only Admin is allowed to view and manage company settings
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
            message="Company configuration and schedule parameters updated successfully."
            autoDismissMs={4000}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}

      {photoToastMessage && (
        <div className="fixed top-5 right-5 z-50">
          <Toast
            variant="success"
            title="Profile Photo"
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
            Global organization identity, timezone, work-week schedule, and platform integration
            toggles.
          </p>
        </div>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 self-start sm:self-auto shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            Unsaved Changes
          </span>
        )}
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
                className="text-xs text-rose-900 underline font-medium hover:text-rose-950"
              >
                Reset to last saved
              </button>
            </div>
          )}

          <AdminProfilePhotoSection onNotify={(msg) => setPhotoToastMessage(msg)} />

          <CompanyProfileSection draft={draft} onUpdate={updateDraft} disabled={isSaving} />

          <WorkWeekSection
            draft={draft}
            onUpdate={updateDraft}
            hasError={hasWorkWeekError}
            errorMessage={workWeekErrorMessage}
            disabled={isSaving}
          />

          <IntegrationsSection
            toggles={draft.integrations}
            onToggle={updateIntegrationToggle}
            disabled={isSaving}
          />

          <SecuritySettingsSection />

          <SystemHealthSection />

          {/* Sticky Action Footer */}
          <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface border border-border rounded-card shadow-raised">
            <div className="text-xs text-text-muted">
              {isDirty ? (
                <span className="text-amber-800 font-medium">
                  You have unsaved changes. Remember to save before navigating away.
                </span>
              ) : (
                <span>All settings are currently synced and up to date.</span>
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
