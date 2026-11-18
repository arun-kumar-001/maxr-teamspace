import type { ProjectPriority, ProjectStatus, ProjectWorkflowStatus } from '../types';

export interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className = '' }: ProjectStatusBadgeProps) {
  const isArchived = status === 'archived';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
        isArchived
          ? 'bg-slate-100 text-slate-700 border-slate-300'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      } ${className}`}
      data-testid="project-status-badge"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isArchived ? 'bg-slate-500' : 'bg-emerald-600'}`}
        aria-hidden="true"
      />
      {isArchived ? 'Archived' : 'Active'}
    </span>
  );
}

const WORKFLOW_META: Record<
  ProjectWorkflowStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  not_started: {
    label: 'Not Started',
    bg: 'rgba(73, 53, 72, 0.08)',
    text: 'rgb(73, 53, 72)',
    border: 'rgba(73, 53, 72, 0.22)',
    dot: 'rgb(73, 53, 72)',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'rgba(85, 205, 179, 0.16)',
    text: 'rgb(15, 118, 110)',
    border: 'rgba(85, 205, 179, 0.45)',
    dot: 'rgb(13, 148, 136)',
  },
  on_hold: {
    label: 'On Hold',
    bg: 'rgba(217, 119, 6, 0.12)',
    text: 'rgb(146, 64, 14)',
    border: 'rgba(217, 119, 6, 0.35)',
    dot: 'rgb(217, 119, 6)',
  },
  completed: {
    label: 'Completed',
    bg: 'rgba(22, 163, 74, 0.12)',
    text: 'rgb(21, 128, 61)',
    border: 'rgba(22, 163, 74, 0.32)',
    dot: 'rgb(22, 163, 74)',
  },
};

export function ProjectWorkflowBadge({
  workflowStatus = 'in_progress',
  className = '',
}: {
  workflowStatus?: ProjectWorkflowStatus;
  className?: string;
}) {
  const meta = WORKFLOW_META[workflowStatus] ?? WORKFLOW_META.in_progress;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${className}`}
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        borderColor: meta.border,
      }}
      data-testid="project-workflow-badge"
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: meta.dot }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

const PRIORITY_META: Record<
  ProjectPriority,
  { label: string; bg: string; text: string; border: string }
> = {
  high: {
    label: 'High',
    bg: 'rgba(220, 38, 38, 0.1)',
    text: 'rgb(185, 28, 28)',
    border: 'rgba(220, 38, 38, 0.28)',
  },
  medium: {
    label: 'Medium',
    bg: 'rgba(73, 53, 72, 0.1)',
    text: 'rgb(73, 53, 72)',
    border: 'rgba(73, 53, 72, 0.25)',
  },
  low: {
    label: 'Low',
    bg: 'rgba(85, 205, 179, 0.14)',
    text: 'rgb(15, 118, 110)',
    border: 'rgba(85, 205, 179, 0.38)',
  },
};

export function ProjectPriorityBadge({
  priority = 'medium',
  className = '',
}: {
  priority?: ProjectPriority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${className}`}
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        borderColor: meta.border,
      }}
      data-testid="project-priority-badge"
    >
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5 4v17h2v-7h5.5l1 2H20V6h-5.5l-1-2H5z" />
      </svg>
      {meta.label} Priority
    </span>
  );
}
