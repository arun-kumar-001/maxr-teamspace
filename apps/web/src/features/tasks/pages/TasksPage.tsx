import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskFilters } from '../components/TaskFilters';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import { TaskTableView } from '../components/TaskTableView';
import { useTasks } from '../hooks/useTasks';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from '../types';

export interface TasksPageProps {
  initialScope?: 'mine' | 'team';
}

export function TasksPage({ initialScope }: TasksPageProps) {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const isAdmin = effectiveRole === ROLES.ADMIN;
  const isTeamLead = effectiveRole === ROLES.TEAM_LEAD;
  const canManage = Boolean(isAdmin || isTeamLead);

  // If initialScope is passed, use it; otherwise Team Lead/Admin default to 'team', staff to 'mine'
  const defaultScope = initialScope ?? (canManage ? 'team' : 'mine');

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const {
    tasks,
    allTasks,
    boardColumns,
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
  } = useTasks({ scope: defaultScope, autoFetch: true });

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

  // Metrics computation for task summary strip
  const totalCount = allTasks.length;
  const inProgressCount = allTasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'in_review',
  ).length;
  const blockedCount = allTasks.filter((t) => t.status === 'blocked').length;
  const completedCount = allTasks.filter((t) => t.status === 'completed').length;
  const overdueCount = allTasks.filter((t) => t.isOverdue).length;

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full"
      data-testid="tasks-page"
    >
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
          {scope === 'team' ? 'Team Tasks' : 'My Tasks'}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {scope === 'team'
            ? 'Manage delegation, assignments, and workflow stages across your team.'
            : 'Track your assigned responsibilities, update progress, and hit milestones.'}
        </p>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-text-subtle uppercase block">Total</span>
          <span className="text-xl font-display font-bold text-text mt-0.5 block">
            {totalCount}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-primary-ink uppercase block">In Flight</span>
          <span className="text-xl font-display font-bold text-primary-ink mt-0.5 block">
            {inProgressCount}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-rose-800 uppercase block">Blocked</span>
          <span className="text-xl font-display font-bold text-danger mt-0.5 block">
            {blockedCount}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-emerald-800 uppercase block">Completed</span>
          <span className="text-xl font-display font-bold text-emerald-700 mt-0.5 block">
            {completedCount}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-danger uppercase block">Overdue</span>
          <span className="text-xl font-display font-bold text-danger mt-0.5 block">
            {overdueCount}
          </span>
        </div>
      </div>

      {/* Filters and Controls */}
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        scope={scope}
        onScopeChange={setScope}
        showScopeToggle={canManage}
        priority={priority}
        onPriorityChange={setPriority}
        status={status}
        onStatusChange={setStatus}
        overdueOnly={overdueOnly}
        onOverdueOnlyToggle={() => setOverdueOnly(!overdueOnly)}
        canCreate={canManage}
        onCreateClick={() => setIsCreateOpen(true)}
      />

      {/* Main Content Area */}
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
      ) : tasks.length === 0 ? (
        <EmptyState
          title={
            search || priority || status || overdueOnly ? 'No matching tasks found' : 'No tasks yet'
          }
          description={
            search || priority || status || overdueOnly
              ? 'Try clearing or modifying your filters to see more tasks.'
              : canManage
                ? 'Assign new tasks to team members to start tracking progress.'
                : 'You have no assigned tasks at the moment.'
          }
          actionLabel={canManage && !search && !priority ? 'Create New Task' : undefined}
          onAction={canManage && !search && !priority ? () => setIsCreateOpen(true) : undefined}
        />
      ) : viewMode === 'board' ? (
        <TaskKanbanBoard
          columns={boardColumns}
          onSelectTask={handleSelectTask}
          onStatusChange={handleStatusChange}
          currentEmployeeId={user?.employeeId}
          isAdmin={isAdmin}
        />
      ) : (
        <TaskTableView
          tasks={tasks}
          onSelectTask={handleSelectTask}
          onStatusChange={handleStatusChange}
          currentEmployeeId={user?.employeeId}
          isAdmin={isAdmin}
        />
      )}

      {/* Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={selectedTask}
        onStatusChange={handleStatusChange}
        onEditClick={(task) => setEditingTask(task)}
        currentEmployeeId={user?.employeeId}
        isAdmin={isAdmin}
      />

      {/* Create Task Modal */}
      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        defaultAssigneeId={user?.employeeId}
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
