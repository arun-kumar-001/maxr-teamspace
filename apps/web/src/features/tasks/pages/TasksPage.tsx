import { useMemo, useState } from 'react';
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

  const defaultScope = initialScope ?? (canManage ? 'team' : 'mine');

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'assigned'>('board');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
      className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full"
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
