import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ErrorState, ForbiddenState, Skeleton } from '../../../components/ui';
import { OnboardingChecklistDetail } from '../components/OnboardingChecklistDetail';
import { useMyOnboarding } from '../hooks/useOnboarding';

export function MyOnboardingPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { detail, isLoading, error, statusCode, refetch } = useMyOnboarding();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" data-testid="my-onboarding-loading">
        <Skeleton height={32} width="40%" />
        <Skeleton height={100} variant="rectangular" />
        <Skeleton height={200} variant="rectangular" />
      </div>
    );
  }

  if (statusCode === 403) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="my-onboarding-forbidden">
        <ForbiddenState
          title="Access Denied"
          message="You do not have permission to view onboarding records."
        />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="my-onboarding-error">
        <ErrorState
          title="Onboarding Record Not Found"
          message={error || 'No onboarding checklist was found for your employee profile.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" data-testid="my-onboarding-page">
      <OnboardingChecklistDetail
        employeeId={detail.employeeId}
        onBack={() => navigate('/dashboard')}
        userRole={role || 'staff'}
        isOwnRecord={true}
      />
    </div>
  );
}

export default MyOnboardingPage;
