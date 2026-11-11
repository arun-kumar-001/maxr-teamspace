import { useMemo, useState } from 'react';
import { Button, Input, Modal, Select, Skeleton } from '../../../components/ui';
import { HIRING_STAGE_META, HIRING_STAGE_ORDER } from '../hooks/useHiringPipeline';
import type { DepartmentItem } from '../types';
import type {
  HiringCandidate,
  HiringRoleOpening,
  HiringStage,
  RoleOpeningStatus,
} from '../types/hiring';
import type { OnboardingChecklistSummary } from '../types/onboarding';
import { OnboardingStepBadge } from './OnboardingStepBadge';
import { getAvatarTone, getInitials } from './hiringUtils';

export interface OnboardingWorkspaceTabProps {
  roles: HiringRoleOpening[];
  candidates: HiringCandidate[];
  checklists: OnboardingChecklistSummary[];
  checklistsLoading: boolean;
  departments: DepartmentItem[];
  onSelectEmployeeChecklist: (employeeId: string) => void;
  onMoveCandidateStage: (candidateId: string, stage: HiringStage) => void;
  onUpdateRoleStatus: (roleId: string, status: RoleOpeningStatus) => void;
  onOpenAddCandidateForRole: (roleId: string) => void;
  onOpenCreateEmployee: () => void;
  onStartCandidateOnboarding: (candidate: HiringCandidate, role?: HiringRoleOpening) => void;
}

const ONBOARDING_STEPS_ORDER = ['hr', 'system', 'it_admin', 'employee'] as const;

function DepartmentIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function daysSince(isoDate: string): number {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

export function OnboardingWorkspaceTab({
  roles,
  candidates,
  checklists,
  checklistsLoading,
  departments,
  onSelectEmployeeChecklist,
  onMoveCandidateStage,
  onUpdateRoleStatus,
  onOpenAddCandidateForRole,
  onOpenCreateEmployee,
  onStartCandidateOnboarding,
}: OnboardingWorkspaceTabProps) {
  const [includeFilled, setIncludeFilled] = useState(false);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const candidatesByRole = useMemo(() => {
    const map = new Map<string, HiringCandidate[]>();
    for (const cand of candidates) {
      const list = map.get(cand.roleId) ?? [];
      list.push(cand);
      map.set(cand.roleId, list);
    }
    return map;
  }, [candidates]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (!includeFilled && role.status === 'filled') return false;
      if (departmentFilter && role.departmentName !== departmentFilter) return false;
      if (q) {
        const hay =
          `${role.title} ${role.departmentName} ${role.hiringManagerName} ${role.code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roles, includeFilled, departmentFilter, search]);

  const filteredChecklists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checklists.filter((chk) => {
      if (!includeFilled && chk.status === 'completed') return false;
      if (departmentFilter && chk.departmentName !== departmentFilter) return false;
      if (q) {
        const hay =
          `${chk.firstName} ${chk.lastName} ${chk.employeeCode} ${chk.designationTitle} ${chk.departmentName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [checklists, includeFilled, departmentFilter, search]);

  const activeRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );
  const activeRoleCandidates = activeRole ? (candidatesByRole.get(activeRole.id) ?? []) : [];

  const departmentNames = useMemo(() => {
    const set = new Set<string>();
    for (const d of departments) set.add(d.name);
    for (const r of roles) set.add(r.departmentName);
    for (const c of checklists) set.add(c.departmentName);
    return Array.from(set).sort();
  }, [departments, roles, checklists]);

  const roleStatusBadge = (status: RoleOpeningStatus) => {
    if (status === 'hiring') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-positive-soft text-positive-ink">
          <span className="w-1.5 h-1.5 rounded-full bg-positive-ink" />
          Hiring
        </span>
      );
    }
    if (status === 'paused') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-tile-yellow text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Paused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-muted text-text-muted">
        Filled
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="onboarding-workspace-tab">
      {/* Toolbar: Hiring now | Include filled toggle + Search + Dept filter + New Employee CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div
          className="inline-flex items-center p-1 rounded-tile bg-surface-muted border border-border self-start"
          role="group"
          aria-label="Onboarding filter mode"
        >
          <button
            type="button"
            onClick={() => setIncludeFilled(false)}
            className={`px-3 py-1.5 rounded-input text-xs font-semibold transition-colors cursor-pointer ${
              !includeFilled ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            Hiring now
          </button>
          <button
            type="button"
            onClick={() => setIncludeFilled(true)}
            className={`px-3 py-1.5 rounded-input text-xs font-semibold transition-colors cursor-pointer ${
              includeFilled ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            Include filled
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-56">
            <Input
              placeholder="Search role or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search onboarding roles and employees"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              options={[
                { value: '', label: 'All Departments' },
                ...departmentNames.map((name) => ({ value: name, label: name })),
              ]}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCreateEmployee}
            data-testid="new-employee-onboarding-btn"
          >
            + New Employee
          </Button>
        </div>
      </div>

      {/* Section 1: Open Roles & Pipeline Readiness (matching Screenshots 2-4) */}
      <section className="space-y-3" aria-label="Role openings and pipeline readiness">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
            Open Roles & Onboarding Pipeline ({filteredRoles.length})
          </h2>
        </div>

        {filteredRoles.length === 0 ? (
          <div className="p-6 rounded-card border border-dashed border-border bg-surface text-center text-sm text-text-muted">
            No role openings match the current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredRoles.map((role) => {
              const roleCandidates = candidatesByRole.get(role.id) ?? [];
              const stageCounts = HIRING_STAGE_ORDER.map((stage) => ({
                stage,
                count: roleCandidates.filter((c) => c.stage === stage).length,
              })).filter((entry) => entry.count > 0);
              const totalCandidates = roleCandidates.length;

              return (
                <article
                  key={role.id}
                  data-testid={`role-opening-card-${role.id}`}
                  className="bg-surface rounded-card border border-border shadow-card hover:shadow-raised transition-shadow p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Dept pill + Status pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text-muted">
                        <DepartmentIcon />
                        <span>{role.departmentName}</span>
                      </span>
                      {roleStatusBadge(role.status)}
                    </div>

                    {/* Title & Subtitle */}
                    <div>
                      <h3 className="text-base font-bold text-text leading-snug">{role.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {role.workMode} &middot; {role.contractType} &middot; {role.compensation}
                      </p>
                    </div>

                    {/* 3 Stat Tiles */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {totalCandidates}
                        </div>
                        <div className="text-[11px] text-text-muted">applicants</div>
                      </div>
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {role.daysOpen}
                        </div>
                        <div className="text-[11px] text-text-muted">days open</div>
                      </div>
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {role.hiresNeeded}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {role.hiresNeeded === 1 ? 'hire needed' : 'hires needed'}
                        </div>
                      </div>
                    </div>

                    {/* Stacked Stage Progress Bar + Legend */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 h-2 w-full rounded-full overflow-hidden bg-surface-muted">
                        {stageCounts.length === 0 ? (
                          <div className="h-full w-full bg-surface-muted" />
                        ) : (
                          stageCounts.map(({ stage, count }) => (
                            <div
                              key={stage}
                              style={{ width: `${(count / totalCandidates) * 100}%` }}
                              className={`h-full rounded-full ${HIRING_STAGE_META[stage].barClass}`}
                              title={`${HIRING_STAGE_META[stage].label}: ${count}`}
                            />
                          ))
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                        {stageCounts.length === 0 ? (
                          <span className="text-text-subtle">No applicants yet</span>
                        ) : (
                          stageCounts.map(({ stage, count }) => (
                            <span key={stage} className="inline-flex items-center gap-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${HIRING_STAGE_META[stage].dotClass}`}
                              />
                              <span>
                                {HIRING_STAGE_META[stage].label} {count}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${getAvatarTone(
                          role.hiringManagerName,
                        )}`}
                      >
                        {getInitials(role.hiringManagerName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text truncate">
                          {role.hiringManagerName}
                        </div>
                        <div className="text-[11px] text-text-subtle">Hiring manager</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      data-testid={`open-role-btn-${role.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-tile border border-border bg-surface text-xs font-semibold text-text hover:bg-surface-muted hover:border-primary-strong/40 transition-colors shrink-0 cursor-pointer"
                    >
                      <span>Open</span>
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Active Employee Onboarding Checklists (live CRM API data) */}
      <section className="space-y-3" aria-label="Employee onboarding checklists">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
            Employee 4-Step Onboarding Checklists ({filteredChecklists.length})
          </h2>
        </div>

        {checklistsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2].map((idx) => (
              <div key={idx} className="p-4 bg-surface rounded-card border border-border space-y-3">
                <Skeleton height={20} width="50%" />
                <Skeleton height={16} width="70%" />
                <Skeleton height={56} variant="rectangular" />
              </div>
            ))}
          </div>
        ) : filteredChecklists.length === 0 ? (
          <div className="p-4 rounded-card border border-border bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs sm:text-sm text-text-muted">
              No active 4-step employee onboarding checklists right now. Register a new employee or
              promote a candidate from the <strong>Hiring</strong> pipeline to start onboarding.
            </div>
            <Button size="sm" variant="outline" onClick={onOpenCreateEmployee}>
              Register Employee
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredChecklists.map((chk) => {
              const progressPct =
                chk.totalItems > 0 ? Math.round((chk.verifiedItems / chk.totalItems) * 100) : 0;
              const currentStepIdx = ONBOARDING_STEPS_ORDER.indexOf(
                chk.currentStep === 'completed' ? 'employee' : chk.currentStep,
              );

              return (
                <article
                  key={chk.id}
                  data-testid={`employee-onboarding-card-${chk.employeeId}`}
                  className="bg-surface rounded-card border border-border shadow-card hover:shadow-raised transition-shadow p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text-muted">
                        <DepartmentIcon />
                        <span>{chk.departmentName}</span>
                      </span>
                      <OnboardingStepBadge step={chk.currentStep} />
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-text leading-snug">
                        {chk.firstName} {chk.lastName}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {chk.designationTitle} &middot; {chk.employeeCode}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {chk.verifiedItems}/{chk.totalItems}
                        </div>
                        <div className="text-[11px] text-text-muted">verified</div>
                      </div>
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {daysSince(chk.createdAt)}
                        </div>
                        <div className="text-[11px] text-text-muted">days open</div>
                      </div>
                      <div className="rounded-tile bg-surface-muted/70 px-2.5 py-2">
                        <div className="text-lg font-bold text-text leading-tight">
                          {progressPct}%
                        </div>
                        <div className="text-[11px] text-text-muted">complete</div>
                      </div>
                    </div>

                    {/* 4-Step Verification Segmented Bar */}
                    <div className="grid grid-cols-4 gap-1">
                      {ONBOARDING_STEPS_ORDER.map((step, idx) => {
                        const isDone =
                          chk.status === 'completed' ||
                          (currentStepIdx >= 0 && idx < currentStepIdx);
                        const isActive = chk.currentStep === step;
                        return (
                          <div
                            key={step}
                            className={`h-2 rounded-full ${
                              isDone
                                ? 'bg-positive-ink'
                                : isActive
                                  ? 'bg-primary-strong'
                                  : 'bg-surface-muted'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2">
                    <div className="text-xs text-text-muted truncate">
                      Joined <span className="font-medium text-text">{chk.joiningDate}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectEmployeeChecklist(chk.employeeId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-tile border border-border bg-surface text-xs font-semibold text-text hover:bg-surface-muted hover:border-primary-strong/40 transition-colors shrink-0 cursor-pointer"
                    >
                      <span>Open</span>
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Slide-Over Role Opening Drawer (Screenshot 4) */}
      <Modal
        isOpen={Boolean(activeRole)}
        onClose={() => setSelectedRoleId(null)}
        title={activeRole?.title ?? ''}
        subtitle={activeRole ? `${activeRole.code} · ${activeRole.departmentName}` : undefined}
        position="drawer"
        maxWidth="md"
      >
        {activeRole && (
          <div className="space-y-5" data-testid="role-opening-drawer">
            {/* Role Metadata */}
            <div className="divide-y divide-border/70 text-xs">
              <div className="py-2 flex items-center justify-between">
                <span className="text-text-muted">Department</span>
                <span className="font-semibold text-text">{activeRole.departmentName}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-text-muted">Contract</span>
                <span className="font-semibold text-text">
                  {activeRole.contractType} &middot; {activeRole.workMode}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-text-muted">Compensation</span>
                <span className="font-semibold text-text">{activeRole.compensation}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-text-muted">Posted</span>
                <span className="font-semibold text-text">
                  {activeRole.postedDate} &middot; {activeRole.daysOpen} days
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-text-muted">Hiring manager</span>
                <span className="font-semibold text-text">{activeRole.hiringManagerName}</span>
              </div>
            </div>

            {/* BY STAGE Progress Bar */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                By Stage
              </div>
              <div className="flex items-center gap-1 h-2.5 w-full rounded-full overflow-hidden bg-surface-muted">
                {activeRoleCandidates.length === 0 ? (
                  <div className="h-full w-full bg-surface-muted" />
                ) : (
                  HIRING_STAGE_ORDER.map((stage) => {
                    const count = activeRoleCandidates.filter((c) => c.stage === stage).length;
                    if (count === 0) return null;
                    return (
                      <div
                        key={stage}
                        style={{ width: `${(count / activeRoleCandidates.length) * 100}%` }}
                        className={`h-full rounded-full ${HIRING_STAGE_META[stage].barClass}`}
                        title={`${HIRING_STAGE_META[stage].label}: ${count}`}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* CANDIDATES LIST */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  Candidates ({activeRoleCandidates.length})
                </span>
              </div>

              {activeRoleCandidates.length === 0 ? (
                <div className="p-4 rounded-tile border border-dashed border-border text-xs text-text-muted text-center">
                  No candidates added to this role yet.
                </div>
              ) : (
                <div className="divide-y divide-border/70 border border-border rounded-tile bg-surface">
                  {activeRoleCandidates.map((cand) => {
                    const meta = HIRING_STAGE_META[cand.stage];
                    const fullName = `${cand.firstName} ${cand.lastName}`;
                    return (
                      <div key={cand.id} className="p-3 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${getAvatarTone(
                              fullName,
                            )}`}
                          >
                            {getInitials(cand.firstName, cand.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-text truncate">
                              {fullName}
                            </div>
                            <div className="text-[11px] text-text-subtle truncate">
                              {cand.source} &middot; {cand.daysInStage}d ago
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            aria-label={`Stage for ${fullName}`}
                            value={cand.stage}
                            onChange={(e) =>
                              onMoveCandidateStage(cand.id, e.target.value as HiringStage)
                            }
                            className={`px-2 py-1 rounded-full text-[11px] font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${meta.pillClass}`}
                          >
                            {HIRING_STAGE_ORDER.map((s) => (
                              <option key={s} value={s}>
                                {HIRING_STAGE_META[s].label}
                              </option>
                            ))}
                          </select>

                          {(cand.stage === 'hired' || cand.stage === 'offer') && (
                            <button
                              type="button"
                              onClick={() => onStartCandidateOnboarding(cand, activeRole)}
                              className="px-2 py-1 rounded-full text-[11px] font-semibold bg-primary-deep text-surface hover:bg-primary-strong transition-colors cursor-pointer"
                              title="Start 4-step CRM Employee Onboarding"
                            >
                              Onboard &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions matching Screenshot 4 */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenAddCandidateForRole(activeRole.id)}
              >
                + Add candidate
              </Button>

              {activeRole.status === 'paused' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateRoleStatus(activeRole.id, 'hiring')}
                >
                  Resume hiring
                </Button>
              ) : activeRole.status === 'hiring' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateRoleStatus(activeRole.id, 'paused')}
                >
                  Pause role
                </Button>
              ) : null}

              {activeRole.status === 'filled' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onUpdateRoleStatus(activeRole.id, 'hiring')}
                >
                  Reopen role
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-rose-50"
                  onClick={() => onUpdateRoleStatus(activeRole.id, 'filled')}
                >
                  Close role
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
