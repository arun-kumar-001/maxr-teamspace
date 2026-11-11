import { useMemo, useState } from 'react';
import { Button, Modal } from '../../../components/ui';
import { HIRING_STAGE_META, HIRING_STAGE_ORDER } from '../hooks/useHiringPipeline';
import type { HiringCandidate, HiringRoleOpening, HiringStage } from '../types/hiring';
import { getAvatarTone, getInitials } from './hiringUtils';

export interface HiringPipelineBoardProps {
  roles: HiringRoleOpening[];
  rolesById: Map<string, HiringRoleOpening>;
  candidates: HiringCandidate[];
  onMoveStage: (candidateId: string, stage: HiringStage) => void;
  onUpdateCandidate: (candidateId: string, patch: Partial<Omit<HiringCandidate, 'id'>>) => void;
  onRemoveCandidate: (candidateId: string) => void;
  onStartOnboarding: (candidate: HiringCandidate, role?: HiringRoleOpening) => void;
}

export function HiringPipelineBoard({
  roles,
  rolesById,
  candidates,
  onMoveStage,
  onUpdateCandidate,
  onRemoveCandidate,
  onStartOnboarding,
}: HiringPipelineBoardProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<HiringStage | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [moveBanner, setMoveBanner] = useState<string | null>(null);

  const departments = useMemo(() => {
    const names = new Set<string>();
    for (const r of roles) {
      if (r.departmentName) names.add(r.departmentName);
    }
    return Array.from(names);
  }, [roles]);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cand of candidates) {
      const role = rolesById.get(cand.roleId);
      if (selectedDept !== 'all' && role?.departmentName !== selectedDept) continue;
      counts.set(cand.roleId, (counts.get(cand.roleId) ?? 0) + 1);
    }
    return counts;
  }, [candidates, rolesById, selectedDept]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      if (selectedRoleId !== 'all' && cand.roleId !== selectedRoleId) return false;
      if (selectedDept !== 'all') {
        const role = rolesById.get(cand.roleId);
        if (role?.departmentName !== selectedDept) return false;
      }
      return true;
    });
  }, [candidates, selectedRoleId, selectedDept, rolesById]);

  const activeCandidate = useMemo(
    () => candidates.find((c) => c.id === activeCandidateId) ?? null,
    [candidates, activeCandidateId],
  );
  const activeCandidateRole = activeCandidate ? rolesById.get(activeCandidate.roleId) : undefined;

  const triggerMove = (candidateId: string, targetStage: HiringStage) => {
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand || cand.stage === targetStage) return;
    onMoveStage(candidateId, targetStage);
    setMoveBanner(
      `Moved ${cand.firstName} ${cand.lastName} to ${HIRING_STAGE_META[targetStage].label}`,
    );
  };

  return (
    <div className="space-y-4" data-testid="hiring-pipeline-board">
      {/* Filter Pills Bar (Role pills on left + Department selector on right) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div
          className="flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label="Filter by role"
        >
          <button
            type="button"
            onClick={() => setSelectedRoleId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              selectedRoleId === 'all'
                ? 'bg-primary-deep text-surface shadow-sm'
                : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-muted'
            }`}
          >
            All roles
          </button>

          {roles.map((role) => {
            const count = roleCounts.get(role.id) ?? 0;
            const isSelected = selectedRoleId === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary-deep text-surface shadow-sm'
                    : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-muted'
                }`}
              >
                <span>{role.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                    isSelected ? 'bg-surface/20 text-surface' : 'bg-surface-muted text-text-subtle'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Department Quick Switcher */}
        <div
          className="inline-flex items-center p-1 rounded-full bg-surface border border-border self-start lg:self-auto shrink-0"
          role="group"
          aria-label="Filter by department"
        >
          <button
            type="button"
            onClick={() => setSelectedDept('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              selectedDept === 'all' ? 'bg-text text-surface' : 'text-text-muted hover:text-text'
            }`}
          >
            All depts
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedDept === dept ? 'bg-text text-surface' : 'text-text-muted hover:text-text'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {moveBanner && (
        <div
          role="status"
          className="flex items-center justify-between px-3 py-2 rounded-tile bg-positive-soft border border-positive-ink/20 text-xs text-positive-ink font-medium"
        >
          <span>{moveBanner}</span>
          <button
            type="button"
            onClick={() => setMoveBanner(null)}
            className="text-positive-ink hover:opacity-75 font-semibold px-1 cursor-pointer"
            aria-label="Dismiss status message"
          >
            &times;
          </button>
        </div>
      )}

      {/* 5-Column Drag-and-Drop Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
        {HIRING_STAGE_ORDER.map((stage) => {
          const meta = HIRING_STAGE_META[stage];
          const stageCandidates = filteredCandidates.filter((c) => c.stage === stage);
          const isDropTarget = dragOverStage === stage;

          return (
            <section
              key={stage}
              aria-label={`${meta.label} column`}
              data-testid={`hiring-column-${stage}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStage !== stage) {
                  setDragOverStage(stage);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverStage((prev) => (prev === stage ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
                setDragOverStage(null);
                setDraggingId(null);
                if (droppedId) {
                  triggerMove(droppedId, stage);
                }
              }}
              className={`rounded-card border p-3 transition-all min-h-[220px] flex flex-col gap-2.5 ${
                isDropTarget
                  ? 'bg-primary-soft/30 border-primary-strong ring-2 ring-primary/25'
                  : 'bg-surface border-border shadow-card'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
                  <h3 className="text-xs sm:text-sm font-semibold text-text truncate">
                    {meta.label}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-muted text-text-muted">
                  {stageCandidates.length}
                </span>
              </div>

              {/* Candidate Cards */}
              <div className="space-y-2.5 flex-1">
                {stageCandidates.length === 0 ? (
                  <div
                    className={`py-8 px-2 text-center rounded-tile border border-dashed text-xs transition-colors ${
                      isDropTarget
                        ? 'border-primary-strong text-primary-deep bg-primary-soft/20'
                        : 'border-border text-text-subtle'
                    }`}
                  >
                    {isDropTarget ? `Drop into ${meta.label}` : 'No candidates'}
                  </div>
                ) : (
                  stageCandidates.map((cand) => {
                    const role = rolesById.get(cand.roleId);
                    const fullName = `${cand.firstName} ${cand.lastName}`;
                    const isBeingDragged = draggingId === cand.id;

                    return (
                      <div
                        key={cand.id}
                        draggable
                        tabIndex={0}
                        role="button"
                        data-testid={`candidate-card-${cand.id}`}
                        onDragStart={(e) => {
                          setDraggingId(cand.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', cand.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverStage(null);
                        }}
                        onClick={() => setActiveCandidateId(cand.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveCandidateId(cand.id);
                          }
                        }}
                        className={`group rounded-tile border border-border bg-surface p-3 text-left transition-all cursor-grab active:cursor-grabbing hover:border-primary-strong/50 hover:shadow-raised focus:outline-none focus:ring-2 focus:ring-primary-strong ${
                          isBeingDragged ? 'opacity-40 scale-[0.98]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${getAvatarTone(
                              fullName,
                            )}`}
                          >
                            {getInitials(cand.firstName, cand.lastName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-text truncate group-hover:text-primary-deep">
                              {fullName}
                            </div>
                            <div className="text-[11px] text-text-muted truncate">
                              {role ? `${role.title} · ${role.departmentName}` : 'Unassigned role'}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-text-subtle">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="inline-flex items-center gap-0.5 shrink-0"
                              aria-label={`Fit rating ${cand.rating} of 5`}
                            >
                              {[1, 2, 3, 4, 5].map((dot) => (
                                <span
                                  key={dot}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    dot <= cand.rating ? 'bg-primary-strong' : 'bg-border-strong'
                                  }`}
                                />
                              ))}
                            </span>
                            <span className="truncate">{cand.source}</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-surface-muted text-text-muted font-medium shrink-0">
                            {cand.daysInStage}d
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Drag & Drop Footer Hint matching Screenshot 1 */}
      <p className="text-xs text-text-subtle">
        Drag a card to another column to move them on. Click to open details.
      </p>

      {/* Candidate Details Slide-Over Drawer */}
      <Modal
        isOpen={Boolean(activeCandidate)}
        onClose={() => setActiveCandidateId(null)}
        title={activeCandidate ? `${activeCandidate.firstName} ${activeCandidate.lastName}` : ''}
        subtitle={
          activeCandidateRole
            ? `${activeCandidateRole.title} · ${activeCandidateRole.departmentName} (${activeCandidateRole.workMode})`
            : undefined
        }
        position="drawer"
        maxWidth="md"
      >
        {activeCandidate && (
          <div className="space-y-5" data-testid="candidate-detail-drawer">
            {/* Contact & Meta */}
            <div className="p-3.5 rounded-tile bg-surface-muted/60 border border-border space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Email</span>
                <span className="font-medium text-text">{activeCandidate.email}</span>
              </div>
              {activeCandidate.phone && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted">Phone</span>
                  <span className="font-medium text-text">{activeCandidate.phone}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Source</span>
                <span className="font-medium text-text">{activeCandidate.source}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Applied</span>
                <span className="font-medium text-text">{activeCandidate.appliedDate}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">Screening Fit</span>
                <div className="flex items-center gap-1">
                  {([1, 2, 3, 4, 5] as const).map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => onUpdateCandidate(activeCandidate.id, { rating: score })}
                      aria-label={`Rate ${score} out of 5`}
                      className="p-0.5 cursor-pointer"
                    >
                      <span
                        className={`block w-2.5 h-2.5 rounded-full ${
                          score <= activeCandidate.rating ? 'bg-primary-strong' : 'bg-border-strong'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage Selector Pills */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                Pipeline Stage
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HIRING_STAGE_ORDER.map((stage) => {
                  const meta = HIRING_STAGE_META[stage];
                  const isCurrent = activeCandidate.stage === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => triggerMove(activeCandidate.id, stage)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-primary-deep text-surface border-primary-deep'
                          : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-muted'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCurrent ? 'bg-surface' : meta.dotClass
                        }`}
                      />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                Interview & Recruiter Notes
              </label>
              <textarea
                rows={4}
                value={activeCandidate.notes ?? ''}
                onChange={(e) => onUpdateCandidate(activeCandidate.id, { notes: e.target.value })}
                placeholder="Add interview feedback, salary expectations, or start date..."
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Lifecycle Transition CTA */}
            <div className="p-3.5 rounded-tile border border-primary-strong/25 bg-primary-soft/25 space-y-2">
              <div className="text-xs font-semibold text-text">Convert to Employee Onboarding</div>
              <p className="text-xs text-text-muted">
                Pre-fill employee registration with {activeCandidate.firstName}&apos;s profile to
                generate their 4-step Onboarding Checklist.
              </p>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => onStartOnboarding(activeCandidate, activeCandidateRole)}
              >
                Start Employee Onboarding &rarr;
              </Button>
            </div>

            {/* Remove Candidate */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:bg-rose-50"
                onClick={() => {
                  onRemoveCandidate(activeCandidate.id);
                  setActiveCandidateId(null);
                }}
              >
                Remove candidate
              </Button>
              <Button type="button" variant="outline" onClick={() => setActiveCandidateId(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
