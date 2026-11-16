import { useNavigate } from 'react-router-dom';
import { PersonalTodoList } from '../components/PersonalTodoList';

export function PersonalTodosPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto" data-testid="personal-todos-page">
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
          To-Do List
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-text">
            Personal To-Do List
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Create, manage, and schedule your personal tasks, reminders, and daily deliverables.
          </p>
        </div>
      </div>

      {/* To-Do List Component */}
      <PersonalTodoList pageSize={10} />
    </div>
  );
}
