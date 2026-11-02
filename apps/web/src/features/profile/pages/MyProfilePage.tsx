import { ErrorState, Skeleton, Toast } from '../../../components/ui';
import { AccountInformation } from '../components/AccountInformation';
import { EmploymentInformation } from '../components/EmploymentInformation';
import { PersonalInformation } from '../components/PersonalInformation';
import { ProfileHeader } from '../components/ProfileHeader';
import { useProfile } from '../hooks/useProfile';

export function MyProfilePage() {
  const {
    profile,
    isLoading,
    isSaving,
    error,
    saveError,
    conflictWarning,
    successMessage,
    isEditingPhone,
    phoneDraft,
    setPhoneDraft,
    startEditingPhone,
    cancelEditingPhone,
    savePhone,
    refetch,
    clearMessages,
  } = useProfile();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6" data-testid="profile-loading-skeleton">
        {/* Header Skeleton */}
        <div className="bg-surface border border-border rounded-card p-6 shadow-card">
          <div className="flex items-center gap-5">
            <Skeleton variant="circular" width={72} height={72} />
            <div className="space-y-2 flex-1">
              <Skeleton width="40%" height={24} />
              <Skeleton width="30%" height={16} />
              <Skeleton width="20%" height={14} />
            </div>
          </div>
        </div>

        {/* Content Skeletons Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-4">
            <Skeleton width="40%" height={20} />
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
          </div>
          <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-4">
            <Skeleton width="40%" height={20} />
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
            <Skeleton width="100%" height={40} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <ErrorState
          title="Unable to load profile"
          message={error || 'An unexpected error occurred while loading your profile.'}
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="my-profile-page">
      {/* Success Notification Toast */}
      {successMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-2">
          <Toast
            variant="success"
            title="Success"
            message={successMessage}
            onClose={clearMessages}
            autoDismissMs={5000}
          />
        </div>
      )}

      {/* Profile Header */}
      <ProfileHeader profile={profile} />

      {/* Main Two-Column Information Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Personal Details with Phone Editor */}
        <PersonalInformation
          profile={profile}
          phoneDraft={phoneDraft}
          isEditingPhone={isEditingPhone}
          isSavingPhone={isSaving}
          saveError={saveError}
          conflictWarning={conflictWarning}
          onDraftChange={setPhoneDraft}
          onStartEditPhone={startEditingPhone}
          onCancelEditPhone={cancelEditingPhone}
          onSavePhone={savePhone}
        />

        {/* Official Employment Details (Read-only) */}
        <EmploymentInformation profile={profile} />
      </div>

      {/* Administrative Account Information (Rendered only when account block exists) */}
      {profile.account && <AccountInformation account={profile.account} />}
    </div>
  );
}
