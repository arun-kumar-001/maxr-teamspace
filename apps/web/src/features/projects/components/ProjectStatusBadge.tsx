import type { ProjectStatus } from '../types';

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
