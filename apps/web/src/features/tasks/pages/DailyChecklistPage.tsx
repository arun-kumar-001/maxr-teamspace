import { useNavigate } from 'react-router-dom';
import { DailyChecklistTracker } from '../components/DailyChecklistTracker';

export function DailyChecklistPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" data-testid="daily-checklist-page">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="hover:text-primary-ink transition-colors font-medium cursor-pointer"
        >
          Workspace
        </button>
        <span className="text-border-strong select-none">/</span>
        <button
          type="button"
          onClick={() => navigate('/staff/tasks')}
          className="hover:text-primary-ink transition-colors font-medium cursor-pointer"
        >
          Tasks
        </button>
        <span className="text-border-strong select-none">/</span>
        <span className="text-text font-semibold" aria-current="page">
          Daily Checklist
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-text">
            Daily Checklist Matrix
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Track daily attendance routines, standups, and recurring workflow targets across dates.
          </p>
        </div>
      </div>

      {/* Matrix Tracker Component */}
      <DailyChecklistTracker />
    </div>
  );
}
