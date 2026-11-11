import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Button, ErrorState, ForbiddenState } from '../../../components/ui';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { HiringPipelineBoard } from '../components/HiringPipelineBoard';
import { OnboardingChecklistDetail } from '../components/OnboardingChecklistDetail';
import { OnboardingWorkspaceTab } from '../components/OnboardingWorkspaceTab';
import { OpenRoleModal } from '../components/OpenRoleModal';
import { useHiringPipeline } from '../hooks/useHiringPipeline';
import { useOnboardingList } from '../hooks/useOnboarding';
import type { HiringCandidate, HiringRoleOpening } from '../types/hiring';

type LifecycleTab = 'hiring' | 'onboarding';

export function OnboardingPage() {
  const { role } = useAuth();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(params.id ?? null);
  const [activeTab, setActiveTab] = useState<LifecycleTab>('hiring');
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [addCandidateDefaultRoleId, setAddCandidateDefaultRoleId] = useState<string | undefined>(
    undefined,
  );
  const [isOpenRoleOpen, setIsOpenRoleOpen] = useState(false);

  const { checklists, total, isLoading, error, statusCode, departments, refetch } =
    useOnboardingList();

  const {
    roles,
    rolesById,
    candidates,
    crmDepartments,
    crmDesignations,
    crmEmployees,
    moveCandidateStage,
    addCandidate,
    updateCandidate,
    removeCandidate,
    addRoleOpening,
    updateRoleStatus,
  } = useHiringPipeline();

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

  const getCreateEmployeePath = () => {
    if (role === 'admin') return '/admin/employees/new';
    if (role === 'hr_manager') return '/hr/employees/new';
    return '/employees/new';
  };

  const handleStartCandidateOnboarding = (
    candidate: HiringCandidate,
    candidateRole?: HiringRoleOpening,
  ) => {
    const query = new URLSearchParams();
    if (candidate.firstName) query.set('firstName', candidate.firstName);
    if (candidate.lastName) query.set('lastName', candidate.lastName);
    if (candidate.email) query.set('email', candidate.email);
    if (candidate.phone) query.set('phone', candidate.phone);
    if (candidateRole?.departmentId) query.set('departmentId', candidateRole.departmentId);
    if (candidateRole?.designationId) query.set('designationId', candidateRole.designationId);
    navigate(`${getCreateEmployeePath()}?${query.toString()}`);
  };

  const openRolesCount = roles.filter((r) => r.status === 'hiring').length;
  const activeChecklistsCount = checklists.filter((c) => c.status !== 'completed').length;
  const onboardingTabCount = openRolesCount + activeChecklistsCount;
  const effectiveDepartments = crmDepartments.length > 0 ? crmDepartments : departments;

  return (
    <div className="space-y-5" data-testid="onboarding-page">
      {/* Header & Contextual Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text font-display">
            {activeTab === 'hiring' ? 'Hiring pipeline' : 'Onboarding'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {openRolesCount} open {openRolesCount === 1 ? 'role' : 'roles'} &middot;{' '}
            {candidates.length} candidates in play &middot; {total} active onboarding{' '}
            {total === 1 ? 'checklist' : 'checklists'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'hiring' ? (
            <Button
              type="button"
              variant="primary"
              data-testid="add-candidate-button"
              onClick={() => {
                setAddCandidateDefaultRoleId(undefined);
                setIsAddCandidateOpen(true);
              }}
            >
              + Add candidate
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              data-testid="open-role-button"
              onClick={() => setIsOpenRoleOpen(true)}
            >
              + Open a role
            </Button>
          )}
        </div>
      </div>

      {/* Underline Navigation Tabs: Hiring | Onboarding */}
      <div
        className="flex items-center gap-6 border-b border-border"
        role="tablist"
        aria-label="Onboarding and lifecycle views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'hiring'}
          data-testid="tab-hiring"
          onClick={() => setActiveTab('hiring')}
          className={`inline-flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer -mb-px ${
            activeTab === 'hiring'
              ? 'border-primary-deep text-text'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <span>Hiring</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-muted text-text-muted">
            {candidates.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'onboarding'}
          data-testid="tab-onboarding"
          onClick={() => setActiveTab('onboarding')}
          className={`inline-flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer -mb-px ${
            activeTab === 'onboarding'
              ? 'border-primary-deep text-text'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <span>Onboarding</span>
          <span
            data-testid="onboarding-total-badge"
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-muted text-text-muted"
          >
            {onboardingTabCount}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'hiring' ? (
        <HiringPipelineBoard
          roles={roles}
          rolesById={rolesById}
          candidates={candidates}
          onMoveStage={moveCandidateStage}
          onUpdateCandidate={updateCandidate}
          onRemoveCandidate={removeCandidate}
          onStartOnboarding={handleStartCandidateOnboarding}
        />
      ) : (
        <OnboardingWorkspaceTab
          roles={roles}
          candidates={candidates}
          checklists={checklists}
          checklistsLoading={isLoading}
          departments={effectiveDepartments}
          onSelectEmployeeChecklist={(empId) => setSelectedId(empId)}
          onMoveCandidateStage={moveCandidateStage}
          onUpdateRoleStatus={updateRoleStatus}
          onOpenAddCandidateForRole={(roleId) => {
            setAddCandidateDefaultRoleId(roleId);
            setIsAddCandidateOpen(true);
          }}
          onOpenCreateEmployee={() => navigate(getCreateEmployeePath())}
          onStartCandidateOnboarding={handleStartCandidateOnboarding}
        />
      )}

      {/* Modals */}
      <AddCandidateModal
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        roles={roles}
        defaultRoleId={addCandidateDefaultRoleId}
        onSubmit={addCandidate}
      />

      <OpenRoleModal
        isOpen={isOpenRoleOpen}
        onClose={() => setIsOpenRoleOpen(false)}
        departments={effectiveDepartments}
        designations={crmDesignations}
        employees={crmEmployees}
        onSubmit={addRoleOpening}
      />
    </div>
  );
}

export default OnboardingPage;
