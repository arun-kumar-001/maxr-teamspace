import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskFilters, type AssigneeOption } from '../components/TaskFilters';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import { TaskTableView } from '../components/TaskTableView';
import { useTasks } from '../hooks/useTasks';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from '../types';

export interface TasksPageProps {
  initialScope?: 'mine' | 'team';
  initialViewMode?: 'board' | 'list';
}

export function TasksPage({ initialScope, initialViewMode }: TasksPageProps) {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const isAdmin = effectiveRole === ROLES.ADMIN;
  const isTeamLead = effectiveRole === ROLES.TEAM_LEAD;
  const canManage = Boolean(isAdmin || isTeamLead);

  const defaultScope = initialScope ?? (canManage ? 'team' : 'mine');

  const [viewMode, setViewMode] = useState<'board' | 'list'>(
    initialViewMode === 'list' ? 'list' : 'board',
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dueDateFilter, setDueDateFilter] = useState<string>('');

  const {
    tasks,
    allTasks,
    loading,
    error,
    scope,
    priority,
    status,
    overdueOnly,
    search,
    setPriority,
    setStatus,
    setOverdueOnly,
    setSearch,
    setScope,
    refetch,
    createTask,
    updateTask,
    changeStatus,
    toggleDailyDone,
  } = useTasks({ scope: defaultScope, autoFetch: true });

  // Dynamic assignee quick-filter list derived from real loaded tasks
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();
    for (const t of allTasks) {
      if (t.assigneeEmployeeId && !map.has(t.assigneeEmployeeId)) {
        map.set(t.assigneeEmployeeId, t.assigneeName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter tasks based on assignee, text search, and optional due date quick-filter
  const visibleTasks = useMemo(() => {
    let result = tasks;
    if (selectedAssigneeId) {
      result = result.filter((t) => t.assigneeEmployeeId === selectedAssigneeId);
    }
    if (dueDateFilter === 'today') {
      result = result.filter((t) => t.status !== 'completed' && t.dueDate === todayStr);
    } else if (dueDateFilter === 'this_week') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
      result = result.filter((t) => {
        if (!t.dueDate || t.status === 'completed') return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= weekAhead;
      });
    } else if (dueDateFilter === 'has_due') {
      result = result.filter((t) => Boolean(t.dueDate));
    } else if (dueDateFilter === 'no_due') {
      result = result.filter((t) => !t.dueDate);
    }
    return result;
  }, [tasks, selectedAssigneeId, dueDateFilter, todayStr]);

  const visibleBoardColumns = useMemo(() => {
    const cols: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      blocked: [],
      completed: [],
    };
    for (const t of visibleTasks) {
      cols[t.status]?.push(t);
    }
    return cols;
  }, [visibleTasks]);

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const updated = await changeStatus(taskId, newStatus);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(updated);
    }
  };

  const handleToggleDailyDone = async (taskId: string) => {
    const updated = await toggleDailyDone(taskId);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(updated);
    }
  };

  const handleReassign = async (taskId: string, assigneeEmployeeId: string) => {
    const target = allTasks.find((t) => t.id === taskId) ?? selectedTask;
    if (!target) return;
    const updated = await updateTask(taskId, {
      assigneeEmployeeId,
      version: target.version,
    });
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(updated);
    }
  };

  const handleCreateSubmit = async (input: CreateTaskInput) => {
    await createTask(input);
  };

  const handleEditSubmit = async (input: Omit<UpdateTaskInput, 'version'>) => {
    if (!editingTask) return;
    const updated = await updateTask(editingTask.id, {
      ...input,
      version: editingTask.version,
    });
    if (selectedTask && selectedTask.id === editingTask.id) {
      setSelectedTask(updated);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Title', 'Project', 'Assignee', 'Priority', 'Status', 'Due Date', 'Overdue'];
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = visibleTasks.map((t) => [
      escape(t.title),
      escape(t.projectName ?? 'Standalone'),
      escape(t.assigneeName),
      escape(t.priority),
      escape(t.status),
      escape(t.dueDate ?? ''),
      escape(t.isOverdue ? 'Yes' : 'No'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Base tasks for stable KPI calculation
  const [baseTasks, setBaseTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!status && !overdueOnly && allTasks.length > 0) {
      setBaseTasks(allTasks);
    }
  }, [allTasks, status, overdueOnly]);

  useEffect(() => {
    setBaseTasks([]);
  }, [scope]);

  const metricsSource = baseTasks.length > 0 ? baseTasks : allTasks;

  // KPI Calculations
  const totalTasksCount = metricsSource.length;
  const inProgressTasksCount = metricsSource.filter((t) => t.status === 'in_progress').length;
  const dueTodayTasksCount = metricsSource.filter(
    (t) => t.status !== 'completed' && t.dueDate === todayStr,
  ).length;
  const overdueTasksCount = metricsSource.filter(
    (t) => t.status !== 'completed' && Boolean(t.isOverdue),
  ).length;

  const isTotalActive = !status && !overdueOnly && !dueDateFilter;
  const isInProgressActive = status === 'in_progress' && !overdueOnly && !dueDateFilter;
  const isDueTodayActive = dueDateFilter === 'today' && !status && !overdueOnly;
  const isOverdueActive = overdueOnly && !status && !dueDateFilter;

  const handleKpiClick = (kpi: 'total' | 'in_progress' | 'due_today' | 'overdue') => {
    if (kpi === 'total') {
      setStatus(undefined);
      setOverdueOnly(false);
      setDueDateFilter('');
    } else if (kpi === 'in_progress') {
      if (status === 'in_progress' && !overdueOnly && !dueDateFilter) {
        setStatus(undefined);
      } else {
        setStatus('in_progress');
        setOverdueOnly(false);
        setDueDateFilter('');
      }
    } else if (kpi === 'due_today') {
      if (dueDateFilter === 'today' && !status && !overdueOnly) {
        setDueDateFilter('');
      } else {
        setDueDateFilter('today');
        setStatus(undefined);
        setOverdueOnly(false);
      }
    } else if (kpi === 'overdue') {
      if (overdueOnly && !status && !dueDateFilter) {
        setOverdueOnly(false);
      } else {
        setOverdueOnly(true);
        setStatus(undefined);
        setDueDateFilter('');
      }
    }
  };

  return (
    <div
      className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl xl:max-w-[1600px] mx-auto w-full"
      data-testid="tasks-page"
    >
      {/* 1. Page Header: Title, Description, Create Task & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
            {scope === 'team' ? 'Team Tasks' : 'My Tasks'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {scope === 'team'
              ? 'Manage team tasks and track work progress across your team.'
              : 'Manage your assigned tasks and track your progress.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {visibleTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5"
              data-testid="export-tasks-btn"
            >
              <svg
                className="w-4 h-4 text-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export</span>
            </Button>
          )}

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5"
              data-testid="create-task-btn"
            >
              <span className="text-base font-bold leading-none">+</span>
              <span>Create Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Four Meaningful Summary KPI Cards with Click-to-Filter */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
        data-testid="tasks-kpi-summary"
      >
        {/* KPI 1: Total Tasks */}
        <button
          type="button"
          onClick={() => handleKpiClick('total')}
          aria-pressed={isTotalActive}
          data-testid="kpi-card-total"
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${
            isTotalActive
              ? 'bg-surface border-primary ring-2 ring-primary-strong/20 shadow-raised'
              : 'bg-surface border-border hover:border-border-strong hover:shadow-card hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text-muted">Total Tasks</span>
            <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
              {totalTasksCount}
            </span>
            <span className="text-[11px] text-text-muted group-hover:text-primary-ink font-medium">
              {isTotalActive ? 'All tasks' : 'View all'}
            </span>
          </div>
        </button>

        {/* KPI 2: In Progress */}
        <button
          type="button"
          onClick={() => handleKpiClick('in_progress')}
          aria-pressed={isInProgressActive}
          data-testid="kpi-card-in-progress"
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${
            isInProgressActive
              ? 'bg-surface border-sky-400 ring-2 ring-sky-500/20 shadow-raised'
              : 'bg-surface border-border hover:border-border-strong hover:shadow-card hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text-muted">In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
              {inProgressTasksCount}
            </span>
            <span className="text-[11px] text-text-muted group-hover:text-sky-700 font-medium">
              {isInProgressActive ? 'Filtered' : 'Filter'}
            </span>
          </div>
        </button>

        {/* KPI 3: Due Today */}
        <button
          type="button"
          onClick={() => handleKpiClick('due_today')}
          aria-pressed={isDueTodayActive}
          data-testid="kpi-card-due-today"
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${
            isDueTodayActive
              ? 'bg-surface border-amber-400 ring-2 ring-amber-500/20 shadow-raised'
              : 'bg-surface border-border hover:border-border-strong hover:shadow-card hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text-muted">Due Today</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
              {dueTodayTasksCount}
            </span>
            <span className="text-[11px] text-text-muted group-hover:text-amber-700 font-medium">
              {isDueTodayActive ? 'Filtered' : 'Filter'}
            </span>
          </div>
        </button>

        {/* KPI 4: Overdue */}
        <button
          type="button"
          onClick={() => handleKpiClick('overdue')}
          aria-pressed={isOverdueActive}
          data-testid="kpi-card-overdue"
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${
            isOverdueActive
              ? 'bg-surface border-rose-400 ring-2 ring-rose-500/20 shadow-raised'
              : 'bg-surface border-border hover:border-border-strong hover:shadow-card hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text-muted">Overdue</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-danger flex items-center justify-center font-bold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
              {overdueTasksCount}
            </span>
            <span className="text-[11px] text-text-muted group-hover:text-danger font-medium">
              {isOverdueActive ? 'Filtered' : 'Filter'}
            </span>
          </div>
        </button>
      </div>

      {/* 3. Tabs, Filters, and Scope Controls */}
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        scope={scope}
        onScopeChange={(nextScope) => {
          setSelectedAssigneeId(undefined);
          setScope(nextScope);
        }}
        showScopeToggle={canManage}
        priority={priority}
        onPriorityChange={setPriority}
        status={status}
        onStatusChange={setStatus}
        dueDateFilter={dueDateFilter}
        onDueDateFilterChange={setDueDateFilter}
        overdueOnly={overdueOnly}
        onOverdueOnlyToggle={() => setOverdueOnly(!overdueOnly)}
        assignees={scope === 'team' ? assigneeOptions : []}
        selectedAssigneeId={selectedAssigneeId}
        onAssigneeSelect={setSelectedAssigneeId}
        counts={{
          board: visibleTasks.length,
          list: visibleTasks.length,
        }}
      />

      {/* 4. Full-Width Workspace: Kanban Board or Table List View */}
      <div className="w-full">
        {loading ? (
          <div className="flex gap-4 overflow-hidden py-4">
            {[1, 2, 3, 4, 5].map((col) => (
              <div
                key={col}
                className="flex-1 min-w-[220px] h-96 bg-surface-muted border border-border rounded-card animate-pulse p-4"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Could not load tasks" message={error} onRetry={() => void refetch()} />
        ) : visibleTasks.length === 0 ? (
          <EmptyState
            title={
              search || priority || status || overdueOnly || dueDateFilter || selectedAssigneeId
                ? 'No matching tasks found'
                : 'No tasks yet'
            }
            description={
              search || priority || status || overdueOnly || dueDateFilter || selectedAssigneeId
                ? 'Try clearing or modifying your filters to see more tasks.'
                : canManage
                  ? 'Delegate work to team members or create a task to get started.'
                  : 'No tasks have been assigned to you yet.'
            }
            actionLabel={
              canManage &&
              !search &&
              !priority &&
              !status &&
              !overdueOnly &&
              !dueDateFilter &&
              !selectedAssigneeId
                ? 'Create First Task'
                : undefined
            }
            onAction={
              canManage &&
              !search &&
              !priority &&
              !status &&
              !overdueOnly &&
              !dueDateFilter &&
              !selectedAssigneeId
                ? () => setIsCreateOpen(true)
                : undefined
            }
          />
        ) : viewMode === 'board' ? (
          <TaskKanbanBoard
            columns={visibleBoardColumns}
            onSelectTask={handleSelectTask}
            onStatusChange={handleStatusChange}
            onToggleDailyDone={handleToggleDailyDone}
            onQuickCreateClick={() => setIsCreateOpen(true)}
            canCreate={canManage}
            currentEmployeeId={user?.employeeId ?? undefined}
            isAdmin={isAdmin}
          />
        ) : (
          <TaskTableView
            tasks={visibleTasks}
            onSelectTask={handleSelectTask}
            onStatusChange={handleStatusChange}
            currentEmployeeId={user?.employeeId ?? undefined}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Task Slide-Over Detail Drawer */}
      <TaskDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={selectedTask}
        onStatusChange={handleStatusChange}
        onReassign={handleReassign}
        onEditClick={(t) => setEditingTask(t)}
        currentEmployeeId={user?.employeeId ?? undefined}
        isAdmin={isAdmin}
      />

      {/* Create Task Modal */}
      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        defaultAssigneeId={scope === 'mine' ? (user?.employeeId ?? undefined) : undefined}
        onSubmitCreate={handleCreateSubmit}
      />

      {/* Edit Task Modal */}
      <TaskFormModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        mode="edit"
        initialTask={editingTask}
        onSubmitEdit={handleEditSubmit}
      />
    </div>
  );
}
