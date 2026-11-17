import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { AssignedToMeView } from '../components/AssignedToMeView';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskFilters, type AssigneeOption } from '../components/TaskFilters';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import { TaskTableView } from '../components/TaskTableView';
import { TaskTodoListSidebar } from '../components/TaskTodoListSidebar';
import { useTasks } from '../hooks/useTasks';
import { getSidebarTodoStats, TODOS_UPDATED_EVENT } from '../utils/todoStats';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from '../types';

export interface TasksPageProps {
  initialScope?: 'mine' | 'team';
  initialViewMode?: 'board' | 'list' | 'assigned';
}

export function TasksPage({ initialScope, initialViewMode }: TasksPageProps) {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const isAdmin = effectiveRole === ROLES.ADMIN;
  const isTeamLead = effectiveRole === ROLES.TEAM_LEAD;
  const canManage = Boolean(isAdmin || isTeamLead);

  const defaultScope = initialScope ?? (canManage ? 'team' : 'mine');

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'assigned'>(
    initialViewMode ?? 'board',
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [todoStats, setTodoStats] = useState(() => getSidebarTodoStats());
  const [isTodoCollapsed, setIsTodoCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      return localStorage.getItem('maxr_tasks_todo_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      setTodoStats(getSidebarTodoStats());
    };
    window.addEventListener(TODOS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, handleUpdate);
  }, []);

  const toggleTodoCollapse = () => {
    setIsTodoCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('maxr_tasks_todo_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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

  // Dynamic assignee quick-filter list derived from real loaded CRM tasks
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();
    for (const t of allTasks) {
      if (t.assigneeEmployeeId && !map.has(t.assigneeEmployeeId)) {
        map.set(t.assigneeEmployeeId, t.assigneeName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  const visibleTasks = useMemo(() => {
    if (!selectedAssigneeId) return tasks;
    return tasks.filter((t) => t.assigneeEmployeeId === selectedAssigneeId);
  }, [tasks, selectedAssigneeId]);

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

  // Live header summary metrics
  const openTasksCount = allTasks.filter((t) => t.status !== 'completed').length;
  const projectCount = new Set(allTasks.map((t) => t.projectId).filter(Boolean)).size;
  const overdueCount = allTasks.filter((t) => t.isOverdue).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueTodayCount = allTasks.filter(
    (t) => t.status !== 'completed' && t.dueDate === todayStr,
  ).length;
  const assignedToMeCount = user?.employeeId
    ? allTasks.filter((t) => t.assigneeEmployeeId === user.employeeId && t.status !== 'completed')
        .length
    : openTasksCount;

  return (
    <div
      className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl xl:max-w-[1600px] mx-auto w-full"
      data-testid="tasks-page"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
            {scope === 'team' ? 'Team Tasks' : 'My Tasks'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {openTasksCount} open across {projectCount}{' '}
            {projectCount === 1 ? 'project' : 'projects'}
            {' · '}
            {overdueCount} overdue · {dueTodayCount} due today
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={isTodoCollapsed ? 'outline' : 'secondary'}
            size="sm"
            onClick={toggleTodoCollapse}
            className="min-h-[40px] flex items-center gap-1.5"
            data-testid="toggle-todo-sidebar-btn"
            title={isTodoCollapsed ? 'Open To-Do List' : 'Hide To-Do List'}
          >
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="14" height="14" rx="3" />
              <path d="M13 3v14" />
              <path d={isTodoCollapsed ? 'm7 8-2 2 2 2' : 'm9 8 2 2-2 2'} />
            </svg>
            <span>{isTodoCollapsed ? `To-Do (${todoStats.total})` : 'Hide To-Do'}</span>
          </Button>

          {visibleTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="min-h-[40px]"
              data-testid="export-tasks-btn"
            >
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Tabs, Filters, and Actions */}
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
        overdueOnly={overdueOnly}
        onOverdueOnlyToggle={() => setOverdueOnly(!overdueOnly)}
        assignees={scope === 'team' ? assigneeOptions : []}
        selectedAssigneeId={selectedAssigneeId}
        onAssigneeSelect={setSelectedAssigneeId}
        counts={{
          board: visibleTasks.length,
          assigned: assignedToMeCount,
        }}
        canCreate={canManage}
        onCreateClick={() => setIsCreateOpen(true)}
      />

      {/* Main Content Area: Left Tasks (Board/List/Assigned) + Right To-Do Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* Left Column: Tasks Views */}
        <div className="flex-1 min-w-0 w-full">
          {loading ? (
            <div className="flex gap-4 overflow-hidden py-4">
              {[1, 2, 3, 4, 5].map((col) => (
                <div
                  key={col}
                  className="flex-1 min-w-[240px] h-96 bg-surface-muted border border-border rounded-card animate-pulse p-4"
                />
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Could not load tasks" message={error} onRetry={() => void refetch()} />
          ) : visibleTasks.length === 0 && viewMode !== 'assigned' ? (
            <EmptyState
              title={
                search || priority || status || overdueOnly || selectedAssigneeId
                  ? 'No matching tasks found'
                  : 'No tasks yet'
              }
              description={
                search || priority || status || overdueOnly || selectedAssigneeId
                  ? 'Try clearing or modifying your filters to see more tasks.'
                  : canManage
                    ? 'Delegate work to team members or create a personal task to get started.'
                    : 'No tasks have been assigned to you yet.'
              }
              actionLabel={
                canManage && !search && !priority && !status && !overdueOnly && !selectedAssigneeId
                  ? 'Create First Task'
                  : undefined
              }
              onAction={
                canManage && !search && !priority && !status && !overdueOnly && !selectedAssigneeId
                  ? () => setIsCreateOpen(true)
                  : undefined
              }
            />
          ) : viewMode === 'assigned' ? (
            <AssignedToMeView
              tasks={allTasks}
              onSelectTask={handleSelectTask}
              onStatusChange={handleStatusChange}
              onToggleDailyDone={handleToggleDailyDone}
              currentEmployeeId={user?.employeeId ?? undefined}
              isAdmin={isAdmin}
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

        {/* Right Column: Collapsible To-Do List Sidebar Panel */}
        {isTodoCollapsed ? (
          <div className="shrink-0 lg:sticky lg:top-6">
            {/* Desktop Collapsed Rail Tab */}
            <button
              type="button"
              onClick={toggleTodoCollapse}
              data-testid="expand-todo-rail-btn"
              className="hidden lg:flex flex-col items-center gap-2.5 p-2.5 w-12 bg-surface border border-border hover:border-primary-strong/50 rounded-2xl shadow-card hover:shadow-raised transition-all duration-200 cursor-pointer group text-text hover:text-primary-deep"
              title="Open To-Do List"
            >
              <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-lr] rotate-180 py-2 font-display text-text-muted group-hover:text-primary-deep select-none">
                To-Do List
              </span>
              {todoStats.total > 0 && (
                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-primary-soft text-primary-deep">
                  {todoStats.pending > 0 ? todoStats.pending : todoStats.total}
                </span>
              )}
            </button>

            {/* Mobile Collapsed Toggle Card */}
            <button
              type="button"
              onClick={toggleTodoCollapse}
              data-testid="expand-todo-mobile-btn"
              className="lg:hidden w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface shadow-xs text-xs font-semibold text-text hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-primary-soft text-primary-deep flex items-center justify-center font-bold text-xs">
                  ✓
                </span>
                <span>To-Do List &amp; Daily Checklist</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep text-[11px] font-bold">
                {todoStats.total} tasks
              </span>
            </button>
          </div>
        ) : (
          <div className="w-full lg:w-80 xl:w-84 shrink-0 lg:sticky lg:top-6 transition-all duration-300">
            <TaskTodoListSidebar onToggleCollapse={toggleTodoCollapse} />
          </div>
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
