import type { Project } from '../types';
import { ProjectStatusBadge } from './ProjectStatusBadge';

export type ProjectLifecycleStage = 'in_process' | 'waiting' | 'delivered';

export interface ProjectTaskSummary {
  total: number;
  open: number;
  completed: number;
  allTodoOrBlocked?: boolean;
}

export function getProjectLifecycleStage(
  project: Project,
  taskSummary?: ProjectTaskSummary,
): ProjectLifecycleStage {
  if (project.status === 'archived') {
    return 'delivered';
  }
  if (taskSummary && taskSummary.total > 0 && taskSummary.completed === taskSummary.total) {
    return 'delivered';
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (project.startDate && project.startDate > todayStr) {
    return 'waiting';
  }
  if (taskSummary && taskSummary.total > 0 && taskSummary.allTodoOrBlocked) {
    return 'waiting';
  }
  return 'in_process';
}

export const PROJECT_STAGE_STYLES: Record<
  ProjectLifecycleStage,
  { label: string; badgeClass: string; dotClass: string; topBorderClass: string }
> = {
  in_process: {
    label: 'In Process',
    badgeClass: 'bg-tile-yellow text-warning border border-warning/20',
    dotClass: 'bg-warning',
    topBorderClass: 'border-t-primary-strong',
  },
  waiting: {
    label: 'Waiting',
    badgeClass: 'bg-primary-soft text-primary-strong border border-primary-soft-border',
    dotClass: 'bg-primary-strong',
    topBorderClass: 'border-t-primary',
  },
  delivered: {
    label: 'Delivered',
    badgeClass: 'bg-positive-soft text-positive-ink border border-positive-ink/20',
    dotClass: 'bg-positive-ink',
    topBorderClass: 'border-t-positive-ink',
  },
};

export interface ProjectCardProps {
  project: Project;
  onSelect: (projectId: string) => void;
  selected?: boolean;
  taskSummary?: ProjectTaskSummary;
  className?: string;
}

export function formatProjectDueSummary(start: string | null, end: string | null): string {
  if (!end) {
    return start ? `Started ${start}` : 'Ongoing';
  }
  const target = new Date(end);
  if (Number.isNaN(target.getTime())) {
    return end;
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  if (diffDays > 1 && diffDays <= 90) return `due in ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -60) return `${Math.abs(diffDays)}d overdue`;
  return `due ${end}`;
}

export function ProjectCard({
  project,
  onSelect,
  selected = false,
  taskSummary,
  className = '',
}: ProjectCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  const stage = getProjectLifecycleStage(project, taskSummary);
  const stageStyle = PROJECT_STAGE_STYLES[stage];

  const progressPct =
    taskSummary && taskSummary.total > 0
      ? Math.round((taskSummary.completed / taskSummary.total) * 100)
      : stage === 'delivered'
        ? 100
        : 0;

  const dueSummary = formatProjectDueSummary(project.startDate, project.endDate);
  const rightMeta =
    taskSummary && taskSummary.total > 0 ? `${taskSummary.open} open · ${dueSummary}` : dueSummary;

  return (
    <div
      onClick={() => onSelect(project.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(project.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for project ${project.name} (${project.code})`}
      data-testid={`project-card-${project.id}`}
      className={`group relative flex flex-col justify-between p-5 bg-surface rounded-card border border-t-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px] ${
        stageStyle.topBorderClass
      } ${
        selected
          ? 'border-primary-strong ring-2 ring-primary/30 shadow-raised'
          : 'border-border shadow-card hover:border-primary-strong/50 hover:shadow-raised hover:-translate-y-0.5'
      } ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-tile bg-surface-muted border border-border text-primary-ink flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </span>
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-text truncate">
              {project.code}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${stageStyle.badgeClass}`}
            title={project.status === 'archived' ? 'Archived' : 'Active'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${stageStyle.dotClass}`}
              aria-hidden="true"
            />
            {stageStyle.label}
          </span>
          <span className="sr-only">
            <ProjectStatusBadge status={project.status} />
          </span>
        </div>

        <h3 className="font-display text-base font-bold text-text group-hover:text-primary-ink transition-colors line-clamp-1">
          {project.name}
        </h3>

        <p className="text-xs text-text-muted line-clamp-1 mt-1">
          {project.description ? project.description : `Lead: ${project.ownerName}`}
        </p>

        {/* Progress Track */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-track overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                project.status === 'archived' ? 'bg-text-subtle' : 'bg-primary'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-text tabular-nums shrink-0">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="pt-3 mt-4 border-t border-border flex items-center justify-between gap-2 text-xs text-text-subtle">
        <div className="flex items-center gap-1.5 min-w-0" title={`Lead: ${project.ownerName}`}>
          <div className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-semibold text-[10px] shrink-0">
            {getInitials(project.ownerName)}
          </div>
          <span className="px-1.5 py-0.5 rounded-full bg-surface-muted border border-border text-[10px] font-semibold text-text-muted tabular-nums shrink-0">
            {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        <span className="text-[11px] font-medium text-text-muted truncate" title={rightMeta}>
          {rightMeta}
        </span>
      </div>
    </div>
  );
}
