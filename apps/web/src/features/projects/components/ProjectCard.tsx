import type { Project } from '../types';
import {
  ProjectPriorityBadge,
  ProjectStatusBadge,
  ProjectWorkflowBadge,
} from './ProjectStatusBadge';

export interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  className?: string;
}

export function ProjectCard({ project, onSelect, className = '' }: ProjectCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const progress = Math.max(0, Math.min(100, project.progressPercent ?? 0));
  const workflowStatus = project.workflowStatus ?? 'in_progress';
  const priority = project.priority ?? 'medium';

  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={`text-left w-full border p-5 flex flex-col justify-between gap-4 transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-strong hover:-translate-y-0.5 ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.74)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'rgba(255, 255, 255, 0.8)',
        boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08), 0 2px 6px rgba(8, 11, 12, 0.04)',
        borderRadius: '20px',
      }}
      data-testid={`project-card-${project.id}`}
    >
      {/* Top section: Project ID, Statuses & Name */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg border"
              style={{
                backgroundColor: 'rgb(244, 247, 246)',
                color: 'rgb(8, 11, 12)',
                borderColor: 'rgba(8, 11, 12, 0.1)',
              }}
            >
              {project.code}
            </span>
            <ProjectPriorityBadge priority={priority} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <ProjectWorkflowBadge workflowStatus={workflowStatus} />
            {project.status === 'archived' && <ProjectStatusBadge status={project.status} />}
          </div>
        </div>

        <div>
          <h3
            className="font-display text-lg font-bold transition-colors line-clamp-1 group-hover:text-primary-ink"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            {project.name}
          </h3>
          {project.description ? (
            <p className="text-sm text-text-muted mt-1 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-text-subtle mt-1 italic">No description provided</p>
          )}
        </div>

        {/* Overall Progress Bar */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text-muted">Overall Progress</span>
            <span className="font-semibold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
              {progress}%
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(8, 11, 12, 0.08)' }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${project.name} completion`}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background:
                  workflowStatus === 'completed'
                    ? 'rgb(22, 163, 74)'
                    : workflowStatus === 'on_hold'
                      ? 'rgb(73, 53, 72)'
                      : 'rgb(85, 205, 179)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom section: Manager, Team Members & Dates */}
      <div className="flex flex-col gap-3 pt-3 border-t border-border/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: 'rgba(85, 205, 179, 0.22)',
                color: 'rgb(8, 11, 12)',
              }}
              aria-hidden="true"
            >
              {getInitials(project.ownerName)}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-text-subtle block leading-tight">
                Project Manager
              </span>
              <span
                className="text-xs font-semibold truncate block"
                style={{ color: 'rgb(8, 11, 12)' }}
                title={project.ownerName}
              >
                {project.ownerName}
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
            style={{
              backgroundColor: 'rgba(73, 53, 72, 0.08)',
              color: 'rgb(73, 53, 72)',
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>
              {project.memberCount} {project.memberCount === 1 ? 'Member' : 'Members'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div
            className="px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgb(244, 247, 246)' }}
          >
            <span className="text-[10px] uppercase tracking-wide text-text-subtle block">
              Start Date
            </span>
            <span className="font-medium text-text">{formatDate(project.startDate)}</span>
          </div>
          <div
            className="px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgb(244, 247, 246)' }}
          >
            <span className="text-[10px] uppercase tracking-wide text-text-subtle block">
              Deadline
            </span>
            <span className="font-medium text-text">{formatDate(project.endDate)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
