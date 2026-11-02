import { randomUUID } from 'node:crypto';
import { ITasksRepository, ListTasksParams } from './tasks.repository';
import { AssigneeRow, NewTask, Task, TaskTx, TaskValues, TaskViewer } from './tasks.types';

type Stored = Omit<Task, 'isOverdue'>;

export interface MemoryEmployee {
  name: string;
  status: string;
  managerId: string | null;
}

/** In-memory tasks for unit and HTTP tests (not shipped in the build). */
export class MemoryTasksRepository implements ITasksRepository {
  tasks: Stored[] = [];
  people: Record<string, MemoryEmployee> = {};
  projectNames: Record<string, string> = {};

  async transaction<T>(work: (tx: TaskTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.tasks);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as TaskTx);
    } catch (err) {
      this.tasks = snapshot;
      throw err;
    }
  }

  private name(id: string): string {
    return this.people[id]?.name ?? id;
  }

  async findAssignee(_tx: TaskTx, employeeId: string): Promise<AssigneeRow | null> {
    const person = this.people[employeeId];
    return person ? { employeeId, status: person.status, managerId: person.managerId } : null;
  }

  async insert(_tx: TaskTx, input: NewTask): Promise<string> {
    const now = new Date().toISOString();
    const task: Stored = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      projectName: input.projectId ? (this.projectNames[input.projectId] ?? null) : null,
      assigneeEmployeeId: input.assigneeEmployeeId,
      assigneeName: this.name(input.assigneeEmployeeId),
      assignerEmployeeId: input.assignerEmployeeId,
      assignerName: this.name(input.assignerEmployeeId),
      status: 'todo',
      priority: input.priority,
      dueDate: input.dueDate,
      completedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(task);
    return task.id;
  }

  async lockForUpdate(_tx: TaskTx, id: string): Promise<Stored | null> {
    const found = this.tasks.find((t) => t.id === id);
    return found ? { ...found } : null;
  }

  async update(_tx: TaskTx, id: string, values: TaskValues): Promise<void> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return;
    Object.assign(found, values, {
      assigneeName: this.name(values.assigneeEmployeeId),
      projectName: values.projectId ? (this.projectNames[values.projectId] ?? null) : null,
      completedAt:
        values.status === 'completed' ? (found.completedAt ?? new Date().toISOString()) : null,
      version: found.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  private manages(viewerId: string, task: Stored): boolean {
    return this.people[task.assigneeEmployeeId]?.managerId === viewerId;
  }

  async find(id: string, viewer: TaskViewer): Promise<Stored | null> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    const visible =
      viewer.all ||
      task.assigneeEmployeeId === viewer.employeeId ||
      task.assignerEmployeeId === viewer.employeeId ||
      this.manages(viewer.employeeId, task);
    return visible ? { ...task } : null;
  }

  async findMany(params: ListTasksParams) {
    const { viewer } = params;
    const matching = this.tasks
      .filter((t) => {
        const inScope =
          params.mode === 'mine'
            ? t.assigneeEmployeeId === viewer.employeeId
            : viewer.all ||
              t.assignerEmployeeId === viewer.employeeId ||
              this.manages(viewer.employeeId, t);
        return (
          inScope &&
          (!params.status || t.status === params.status) &&
          (!params.priority || t.priority === params.priority) &&
          (!params.projectId || t.projectId === params.projectId) &&
          (!params.assigneeEmployeeId || t.assigneeEmployeeId === params.assigneeEmployeeId) &&
          (!params.dueFrom || (t.dueDate !== null && t.dueDate >= params.dueFrom)) &&
          (!params.dueTo || (t.dueDate !== null && t.dueDate <= params.dueTo)) &&
          (!params.overdueBefore ||
            (t.status !== 'completed' && t.dueDate !== null && t.dueDate < params.overdueBefore))
        );
      })
      .sort(
        (a, b) =>
          Number(a.status === 'completed') - Number(b.status === 'completed') ||
          (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
          a.createdAt.localeCompare(b.createdAt),
      );
    return {
      items: matching.slice(params.offset, params.offset + params.limit).map((t) => ({ ...t })),
      total: matching.length,
    };
  }
}
