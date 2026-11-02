import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import type { CompanySettingsReader } from '../settings';
import type { ProjectReader } from '../projects';
import { TaskStatus, checkTransition } from './task-rules';
import { ITasksRepository } from './tasks.repository';
import type {
  CreateTaskInput,
  ListMyTasksQuery,
  ListTeamTasksQuery,
  UpdateTaskInput,
} from './tasks.schemas';
import { Task, TaskTx, TaskValues, TaskViewer } from './tasks.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export interface TaskCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

type StoredTask = Omit<Task, 'isOverdue'>;

export class TasksService {
  constructor(
    private readonly repository: ITasksRepository,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly projects: ProjectReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** `YYYY-MM-DD` of today on the company clock. */
  private async today(): Promise<string> {
    const { timezone } = await this.settings.getBasic();
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(this.clock());
  }

  private withOverdue(task: StoredTask, today: string): Task {
    return {
      ...task,
      isOverdue: task.status !== 'completed' && !!task.dueDate && task.dueDate < today,
    };
  }

  async listMine(query: ListMyTasksQuery, caller: TaskCaller): Promise<PaginatedResponse<Task>> {
    return this.page(query, { employeeId: caller.employeeId, all: false }, 'mine');
  }

  async listTeam(query: ListTeamTasksQuery, viewer: TaskViewer): Promise<PaginatedResponse<Task>> {
    return this.page(query, viewer, 'team');
  }

  private async page(
    query: ListMyTasksQuery | ListTeamTasksQuery,
    viewer: TaskViewer,
    mode: 'mine' | 'team',
  ): Promise<PaginatedResponse<Task>> {
    const today = await this.today();
    const { items, total } = await this.repository.findMany({
      viewer,
      mode,
      status: query.status,
      priority: query.priority,
      projectId: query.projectId,
      assigneeEmployeeId: 'assigneeEmployeeId' in query ? query.assigneeEmployeeId : undefined,
      dueFrom: query.dueFrom,
      dueTo: query.dueTo,
      overdueBefore: query.overdue ? today : undefined,
      ...toOffsetLimit(query),
    });
    return buildPage(
      items.map((task) => this.withOverdue(task, today)),
      total,
      query,
    );
  }

  async get(id: string, viewer: TaskViewer): Promise<Task> {
    const found = await this.repository.find(id, viewer);
    // A task you are not party to looks exactly like one that does not exist.
    if (!found) throw notFound('Task not found');
    return this.withOverdue(found, await this.today());
  }

  /**
   * A Team Lead assigns to their direct reports or to themselves; an Admin to anyone active
   * (D-14). With a project, the assigner must be able to see it, it must be active, and the
   * assignee must be one of its members.
   */
  async create(input: CreateTaskInput, caller: TaskCaller, viewer: TaskViewer): Promise<Task> {
    const today = await this.today();
    if (input.dueDate && input.dueDate < today) {
      throw unprocessable('The due date cannot be in the past');
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    const id = await this.repository.transaction(async (tx) => {
      await this.assertAssignable(tx, caller.employeeId, input.assigneeEmployeeId, viewer.all);
      if (input.projectId) {
        await this.assertProjectUsable(
          input.projectId,
          caller.employeeId,
          input.assigneeEmployeeId,
          viewer.all,
        );
      }
      const taskId = await this.repository.insert(tx, {
        title: input.title,
        description: input.description ?? null,
        projectId: input.projectId ?? null,
        assigneeEmployeeId: input.assigneeEmployeeId,
        assignerEmployeeId: caller.employeeId,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
      });
      // The title is left out of the trail: tasks can name people and clients.
      await audit.record(
        {
          action: 'task.create',
          outcome: 'success',
          entityType: 'task',
          entityId: taskId,
          changes: {
            assigneeEmployeeId: input.assigneeEmployeeId,
            priority: input.priority,
            projectId: input.projectId ?? null,
            dueDate: input.dueDate ?? null,
          },
        },
        { transaction: tx },
      );
      events.add({
        type: 'tasks.assigned',
        payload: {
          taskId,
          assigneeEmployeeId: input.assigneeEmployeeId,
          assignerEmployeeId: caller.employeeId,
        },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });
      return taskId;
    });
    await events.flush(this.platform.events);
    return this.get(id, viewer);
  }

  /**
   * The assigner or an Admin edits a task that is not completed. Giving it to someone else
   * restarts it as `todo` for them. The `version` must be the one the caller read.
   */
  async update(
    id: string,
    input: UpdateTaskInput,
    caller: TaskCaller,
    viewer: TaskViewer,
  ): Promise<Task> {
    await this.get(id, viewer);
    const today = await this.today();
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.lockForUpdate(tx, id);
      if (!current) throw notFound('Task not found');
      if (current.assignerEmployeeId !== caller.employeeId && !viewer.all) {
        throw forbidden('Only the person who assigned the task, or an Admin, can edit it');
      }
      if (current.version !== input.version) {
        throw conflict('This task was changed by someone else; reload it and try again');
      }
      if (current.status === 'completed') {
        throw unprocessable('A completed task is read-only; reopen it first');
      }
      const reassigned =
        input.assigneeEmployeeId !== undefined &&
        input.assigneeEmployeeId !== current.assigneeEmployeeId;
      const next: TaskValues = {
        title: input.title ?? current.title,
        description: input.description === undefined ? current.description : input.description,
        projectId: input.projectId === undefined ? current.projectId : input.projectId,
        assigneeEmployeeId: input.assigneeEmployeeId ?? current.assigneeEmployeeId,
        priority: input.priority ?? current.priority,
        dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
        status: reassigned ? 'todo' : current.status,
      };
      if (next.dueDate && next.dueDate !== current.dueDate && next.dueDate < today) {
        throw unprocessable('The due date cannot be in the past');
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(next) as Array<keyof TaskValues>) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      if (Object.keys(changes).length === 0) return;
      if (reassigned) {
        await this.assertAssignable(
          tx,
          current.assignerEmployeeId,
          next.assigneeEmployeeId,
          viewer.all,
        );
      }
      if (next.projectId && (next.projectId !== current.projectId || reassigned)) {
        await this.assertProjectUsable(
          next.projectId,
          current.assignerEmployeeId,
          next.assigneeEmployeeId,
          viewer.all,
        );
      }
      await this.repository.update(tx, id, next);
      // Titles and descriptions are free text and stay out of the trail; only that they changed.
      const trail = { ...changes };
      for (const key of ['title', 'description'] as const) {
        if (trail[key]) trail[key] = { from: '[changed]', to: '[changed]' };
      }
      await audit.record(
        {
          action: 'task.update',
          outcome: 'success',
          entityType: 'task',
          entityId: id,
          changes: trail,
        },
        { transaction: tx },
      );
      if (reassigned) {
        events.add({
          type: 'tasks.assigned',
          payload: {
            taskId: id,
            assigneeEmployeeId: next.assigneeEmployeeId,
            assignerEmployeeId: current.assignerEmployeeId,
          },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
      }
    });
    await events.flush(this.platform.events);
    return this.get(id, viewer);
  }

  /**
   * Moves a task along the transition table (D-14). Repeating the move to the status the task
   * already has is a harmless 200. The task row is locked, so two moves at once are checked one
   * after the other against the real current status.
   */
  async changeStatus(
    id: string,
    to: TaskStatus,
    caller: TaskCaller,
    viewer: TaskViewer,
  ): Promise<Task> {
    await this.get(id, viewer);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.lockForUpdate(tx, id);
      if (!current) throw notFound('Task not found');
      if (current.status === to) return;
      const verdict = checkTransition(current.status, to, {
        isAssignee: current.assigneeEmployeeId === caller.employeeId,
        isAssigner: current.assignerEmployeeId === caller.employeeId,
        isAdmin: viewer.all,
      });
      if (!verdict.ok) {
        throw verdict.reason === 'forbidden'
          ? forbidden(verdict.message)
          : unprocessable(verdict.message);
      }
      await this.repository.update(tx, id, {
        title: current.title,
        description: current.description,
        projectId: current.projectId,
        assigneeEmployeeId: current.assigneeEmployeeId,
        priority: current.priority,
        dueDate: current.dueDate,
        status: to,
      });
      await audit.record(
        {
          action: 'task.status',
          outcome: 'success',
          entityType: 'task',
          entityId: id,
          changes: { status: { from: current.status, to } },
        },
        { transaction: tx },
      );
      events.add({
        type: 'tasks.status_changed',
        payload: {
          taskId: id,
          from: current.status,
          to,
          assigneeEmployeeId: current.assigneeEmployeeId,
          assignerEmployeeId: current.assignerEmployeeId,
          byEmployeeId: caller.employeeId,
        },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });
    });
    await events.flush(this.platform.events);
    return this.get(id, viewer);
  }

  /** The assignee must be active, and for a Team Lead be themselves or a direct report. */
  private async assertAssignable(
    tx: TaskTx,
    assignerId: string,
    assigneeId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const assignee = await this.repository.findAssignee(tx, assigneeId);
    if (!assignee || assignee.status !== 'active') {
      throw unprocessable('The assignee must be an active employee');
    }
    if (!isAdmin && assigneeId !== assignerId && assignee.managerId !== assignerId) {
      throw forbidden('You can only assign tasks to yourself or your own team');
    }
  }

  private async assertProjectUsable(
    projectId: string,
    assignerId: string,
    assigneeId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const project = await this.projects.access(projectId);
    const sees =
      project &&
      (isAdmin ||
        project.ownerEmployeeId === assignerId ||
        project.memberEmployeeIds.includes(assignerId));
    // A project the assigner cannot see looks exactly like one that does not exist.
    if (!project || !sees) throw unprocessable('Choose a project you belong to');
    if (project.status !== 'active')
      throw unprocessable('Tasks cannot be added to an archived project');
    if (!project.memberEmployeeIds.includes(assigneeId)) {
      throw unprocessable('The assignee is not a member of that project');
    }
  }
}
