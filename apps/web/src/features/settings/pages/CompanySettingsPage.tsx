import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Toast } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';
import { useNavigationBlocker } from '../../../shell/NavigationBlockerContext';
import { useSettings } from '../hooks/useSettings';
import { CompanyProfileSection } from '../components/CompanyProfileSection';
import { CompanyLogoSection } from '../components/CompanyLogoSection';
import { WorkingTimeSection } from '../components/WorkingTimeSection';
import { AttendanceSetupSection } from '../components/AttendanceSetupSection';
import { LeaveSetupSection } from '../components/LeaveSetupSection';

type SettingsTab = 'branding' | 'attendance' | 'leave';

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

function IconAlertTriangle({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const TABS: {
  id: SettingsTab;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
}[] = [
  { id: 'branding', label: 'Identity & Logo', icon: IconBuilding },
  { id: 'attendance', label: 'Attendance & Work Schedule', icon: IconClock },
  { id: 'leave', label: 'Leave Setup', icon: IconCalendar },
];

export function CompanySettingsPage() {
  const navigate = useNavigate();
  const { role, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding');
  const [showToast, setShowToast] = useState(false);
  const [photoToastMessage, setPhotoToastMessage] = useState<string | null>(null);

  // Unsaved Navigation Intercept Modal State
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);

  const {
    draft,
    isLoading,
    isSaving,
    error,
    isDirty,
    hasWorkWeekError,
    workWeekErrorMessage,
    updateDraft,
    saveSettings,
    resetDraft,
    refetch,
  } = useSettings();

  // Block in-app navigation when changes are unsaved
  useNavigationBlocker('company-settings', isDirty, (nextPath) => {
    setPendingNavigationPath(nextPath);
    setIsUnsavedModalOpen(true);
  });

  // Warn browser beforeunload if page is closed/reloaded with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Intercept anchor clicks across page when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handleClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (
          href &&
          !href.startsWith('#') &&
          href !== '/settings' &&
          href !== window.location.pathname
        ) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigationPath(href);
          setIsUnsavedModalOpen(true);
        }
      }
    };
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [isDirty]);

  // Role Gate: Only System Administrators can access this configuration
  if (!authLoading && role !== ROLES.ADMIN) {
    return (
      <div className="space-y-6 w-full min-w-0">
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
    return success;
  };

  return (
    <div className="space-y-6 w-full min-w-0" data-testid="company-settings-page">
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

      {/* Header with Top Right Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">
            Company Configuration
          </h1>
        </div>

        {/* Top Right Save Action (clean readable disabled state vs solid primary active state, no dots) */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <Button
            variant={isDirty ? 'primary' : 'secondary'}
            size="md"
            disabled={!isDirty || hasWorkWeekError || isSaving}
            isLoading={isSaving}
            onClick={handleSave}
            className={`min-h-[42px] px-5 font-semibold transition-all duration-200 ${
              !isDirty
                ? 'bg-surface border border-border-strong text-text-muted/80 shadow-2xs opacity-80 cursor-not-allowed'
                : 'bg-primary-deep text-white shadow-md shadow-teal-900/20 hover:bg-[#0d655e] cursor-pointer'
            }`}
            data-testid="save-settings-btn"
          >
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </Button>
        </div>
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

          {/* Tab 1: Identity & Logo */}
          <div
            className={activeTab === 'branding' ? 'space-y-6' : 'hidden'}
            data-tab-panel="branding"
          >
            <CompanyLogoSection
              companyName={draft.companyName}
              logoUrl={draft.companyLogo}
              onUpdateLogo={(newLogo) => updateDraft({ companyLogo: newLogo })}
              onNotify={(msg) => setPhotoToastMessage(msg)}
              disabled={isSaving}
            />

            <CompanyProfileSection draft={draft} onUpdate={updateDraft} disabled={isSaving} />
          </div>

          {/* Tab 2: Attendance & Work Schedule */}
          <div
            className={activeTab === 'attendance' ? 'space-y-6' : 'hidden'}
            data-tab-panel="attendance"
          >
            <WorkingTimeSection
              draft={draft}
              onUpdate={updateDraft}
              hasError={hasWorkWeekError}
              errorMessage={workWeekErrorMessage}
              disabled={isSaving}
            />

            <AttendanceSetupSection draft={draft} onUpdate={updateDraft} disabled={isSaving} />
          </div>

          {/* Tab 3: Leave Setup */}
          <div className={activeTab === 'leave' ? 'space-y-6' : 'hidden'} data-tab-panel="leave">
            <LeaveSetupSection draft={draft} onUpdate={updateDraft} disabled={isSaving} />
          </div>
        </div>
      ) : null}

      {/* Unsaved Changes Confirmation Modal */}
      {isUnsavedModalOpen && (
        <Modal
          isOpen={isUnsavedModalOpen}
          onClose={() => {
            setIsUnsavedModalOpen(false);
            setPendingNavigationPath(null);
          }}
          maxWidth="sm"
        >
          <div className="relative py-2 text-center">
            {/* Top Right Close Button */}
            <button
              type="button"
              onClick={() => {
                setIsUnsavedModalOpen(false);
                setPendingNavigationPath(null);
              }}
              className="absolute -top-1 -right-2 p-1.5 rounded-lg text-text-subtle hover:text-text hover:bg-surface-muted transition-colors cursor-pointer"
              aria-label="Close dialog"
              data-testid="modal-stay-btn"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Centered Warning Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
              <IconAlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            {/* Centered Title & Description */}
            <h3 className="text-base font-bold text-text">Unsaved Changes</h3>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed max-w-[280px] mx-auto">
              You have unsaved changes in company settings. Would you like to save or discard your
              modifications before leaving?
            </p>

            {/* Compact Centered Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 mt-5">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  resetDraft();
                  setIsUnsavedModalOpen(false);
                  const target = pendingNavigationPath;
                  setPendingNavigationPath(null);
                  if (target) {
                    navigate(target);
                  }
                }}
                className="!min-h-[32px] sm:!min-h-[32px] px-3.5 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-2xs border-0 rounded-lg transition-all"
                data-testid="modal-discard-btn"
              >
                Discard Changes
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await handleSave();
                  if (success !== false) {
                    setIsUnsavedModalOpen(false);
                    const target = pendingNavigationPath;
                    setPendingNavigationPath(null);
                    if (target) {
                      navigate(target);
                    }
                  }
                }}
                disabled={hasWorkWeekError || isSaving}
                isLoading={isSaving}
                className="!min-h-[32px] sm:!min-h-[32px] px-3.5 py-1 text-xs font-medium border border-border-strong text-text bg-surface hover:bg-surface-muted rounded-lg transition-all shadow-2xs"
                data-testid="modal-save-btn"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
