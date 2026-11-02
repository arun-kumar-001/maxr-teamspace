import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Badge, Button, ErrorState, ForbiddenState, Input, Select } from '../../../components/ui';
import { OnboardingBoard } from '../components/OnboardingBoard';
import { OnboardingChecklistDetail } from '../components/OnboardingChecklistDetail';
import { useOnboardingList } from '../hooks/useOnboarding';
import type { OnboardingStep } from '../types/onboarding';

export function OnboardingPage() {
  const { role } = useAuth();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(params.id ?? null);

  const {
    checklists,
    total,
    isLoading,
    error,
    statusCode,
    departments,
    query,
    setSearch,
    setStep,
    setDepartmentId,
    resetFilters,
    refetch,
  } = useOnboardingList();

  if (statusCode === 403) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="onboarding-page">
        <ForbiddenState
          title="Access Restricted"
          message="You do not have permission to view or manage employee onboarding."
        />
      </div>
    );
  }

  if (error && !isLoading && checklists.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="onboarding-page">
        <ErrorState title="Failed to Load Onboarding" message={error} onRetry={refetch} />
      </div>
    );
  }

  const activeEmployeeId = params.id || selectedId;

  if (activeEmployeeId) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="onboarding-detail-view">
        <OnboardingChecklistDetail
          employeeId={activeEmployeeId}
          onBack={() => {
            setSelectedId(null);
            if (params.id) {
              navigate('/hr/onboarding');
            }
          }}
          userRole={role || 'hr_manager'}
        />
      </div>
    );
  }

  const stepOptions = [
    { value: '', label: 'All Stages' },
    { value: 'hr', label: 'HR Setup' },
    { value: 'system', label: 'System Access' },
    { value: 'it_admin', label: 'IT / Admin' },
    { value: 'employee', label: 'Employee Setup' },
  ];

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <div className="space-y-6" data-testid="onboarding-page">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Employee Onboarding
            </h1>
            {!isLoading && (
              <Badge variant="primary" data-testid="onboarding-total-badge">
                {total} {total === 1 ? 'In Progress' : 'In Progress'}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Track and verify the 4-step onboarding checklist before granting account activation.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-surface rounded-card border border-border shadow-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Search by name or code..."
            value={query.search || ''}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
          />

          <Select
            options={stepOptions}
            value={query.step || ''}
            onChange={(e) => setStep((e.target.value as OnboardingStep) || undefined)}
            aria-label="Filter by onboarding stage"
          />

          <Select
            options={departmentOptions}
            value={query.departmentId || ''}
            onChange={(e) => setDepartmentId(e.target.value || undefined)}
            aria-label="Filter by department"
          />

          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Board View */}
      <OnboardingBoard
        checklists={checklists}
        isLoading={isLoading}
        onSelectEmployee={(empId) => setSelectedId(empId)}
      />
    </div>
  );
}

export default OnboardingPage;
