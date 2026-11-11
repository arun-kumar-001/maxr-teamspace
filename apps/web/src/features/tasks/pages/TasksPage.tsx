import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { EmptyState } from '../../../components/ui/StateCards';
import { TaskCalendar } from '../components/TaskCalendar';
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
      {/* Page Header Row: My Tasks (Left) + Img 1 Content Filters/Actions on the Right Side */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        {/* Left: Title & Subtitle (Img 2) */}
        <div className="shrink-0 max-w-sm pt-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
            {scope === 'team' ? 'Team Tasks' : 'My Tasks'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {scope === 'team'
              ? 'Manage delegation, assignments, and workflow stages across your team.'
              : 'Track your assigned responsibilities, update progress, and hit milestones.'}
          </p>
        </div>

        {/* Right Side: Img 1 Content (Filters, View Mode & Add Task Controls) */}
        <div className="flex-1 w-full xl:max-w-3xl">
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
            canCreate={true}
            onCreateClick={() => setIsCreateOpen(true)}
          />
        </div>
      </div>

      {/* Task Calendar */}
      <TaskCalendar
        tasks={allTasks}
        onSelectTask={handleSelectTask}
        metrics={{
          total: totalCount,
          inProgress: inProgressCount,
          blocked: blockedCount,
          completed: completedCount,
          overdue: overdueCount,
        }}
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
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs sm:text-sm">
            <span className="font-medium">API Connection: {error}. Showing local task board.</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-white hover:bg-amber-100/50 transition-colors shrink-0"
            >
              Retry Sync
            </button>
          </div>
          {viewMode === 'board' ? (
            <TaskKanbanBoard
              columns={boardColumns}
              onSelectTask={handleSelectTask}
              onStatusChange={handleStatusChange}
              onAddTask={() => setIsCreateOpen(true)}
              currentEmployeeId={user?.employeeId}
              isAdmin={isAdmin}
            />
          ) : (
            <TaskTableView
              tasks={allTasks}
              onSelectTask={handleSelectTask}
              onStatusChange={handleStatusChange}
              currentEmployeeId={user?.employeeId}
              isAdmin={isAdmin}
            />
          )}
        </div>
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
          onAddTask={() => setIsCreateOpen(true)}
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
