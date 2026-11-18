import type { ProjectsSummary } from '../types';

export interface ProjectOverviewCardsProps {
  summary: ProjectsSummary;
  loading?: boolean;
}

export function ProjectOverviewCards({ summary, loading = false }: ProjectOverviewCardsProps) {
  const cards = [
    {
      id: 'total-assigned',
      label: 'Total Assigned Projects',
      value: summary.totalAssigned,
      caption: 'Active initiatives assigned to you',
      accentBg: 'rgba(85, 205, 179, 0.18)',
      accentColor: 'rgb(15, 118, 110)',
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      ),
    },
    {
      id: 'in-progress',
      label: 'In Progress',
      value: summary.inProgress,
      caption: 'Currently active deliverables',
      accentBg: 'rgba(85, 205, 179, 0.22)',
      accentColor: 'rgb(8, 11, 12)',
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      id: 'completed',
      label: 'Completed Projects',
      value: summary.completed,
      caption: 'Delivered & signed off',
      accentBg: 'rgba(22, 163, 74, 0.14)',
      accentColor: 'rgb(21, 128, 61)',
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'upcoming',
      label: 'Upcoming Projects',
      value: summary.upcoming,
      caption: 'Scheduled & preparing kickoff',
      accentBg: 'rgba(73, 53, 72, 0.14)',
      accentColor: 'rgb(73, 53, 72)',
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      data-testid="projects-overview-cards"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex flex-col gap-3 p-5 border transition-all duration-200 hover:-translate-y-0.5"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(255, 255, 255, 0.75)',
            boxShadow: '0 10px 30px rgba(85, 205, 179, 0.08), 0 2px 6px rgba(8, 11, 12, 0.04)',
            borderRadius: '20px',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
              {card.label}
            </span>
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: card.accentBg, color: card.accentColor }}
              aria-hidden="true"
            >
              {card.icon}
            </span>
          </div>

          {loading ? (
            <div className="h-8 w-16 rounded-lg bg-surface-muted animate-pulse" />
          ) : (
            <span
              className="font-display text-3xl font-bold tabular-nums leading-none"
              style={{ color: 'rgb(8, 11, 12)' }}
              data-testid={`overview-count-${card.id}`}
            >
              {card.value}
            </span>
          )}

          <span className="text-xs text-text-muted">{card.caption}</span>
        </div>
      ))}
    </div>
  );
}
