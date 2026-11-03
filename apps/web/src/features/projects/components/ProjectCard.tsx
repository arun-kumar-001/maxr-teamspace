import type { Project } from '../types';
import { ProjectStatusBadge } from './ProjectStatusBadge';

export interface ProjectCardProps {
  project: Project;
  onSelect: (projectId: string) => void;
  className?: string;
}

export function ProjectCard({ project, onSelect, className = '' }: ProjectCardProps) {
  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'Ongoing';
    if (start && end) return `${start} → ${end}`;
    if (start) return `Started ${start}`;
    return `Ends ${end}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

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
      className={`group relative flex flex-col justify-between p-5 bg-surface rounded-card border border-border shadow-card hover:border-primary-strong/40 hover:shadow-raised transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px] ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
              {project.code}
            </span>
            <ProjectStatusBadge status={project.status} />
          </div>
          <span className="text-xs text-text-subtle whitespace-nowrap">v{project.version}</span>
        </div>

        <h3 className="font-display text-lg font-semibold text-text group-hover:text-primary-ink transition-colors line-clamp-1 mb-1.5">
          {project.name}
        </h3>

        {project.description ? (
          <p className="text-sm text-text-muted line-clamp-2 mb-4">{project.description}</p>
        ) : (
          <p className="text-sm text-text-subtle italic mb-4">No description provided</p>
        )}
      </div>

      <div className="pt-3 border-t border-border flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-medium text-[11px] shrink-0">
              {getInitials(project.ownerName)}
            </div>
            <span
              className="truncate max-w-[130px] font-medium text-text"
              title={project.ownerName}
            >
              {project.ownerName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-text-subtle">
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
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>
              {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-text-subtle">
          <div className="flex items-center gap-1">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formatDateRange(project.startDate, project.endDate)}</span>
          </div>

          <span className="text-primary-ink font-medium group-hover:underline inline-flex items-center gap-0.5">
            Details →
          </span>
        </div>
      </div>
    </div>
  );
}
