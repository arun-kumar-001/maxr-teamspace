import {
  CreateTodoDto,
  ITodosRepository,
  ListTodosQuery,
  ListTodosResult,
  PersonalTodo,
  UpdateTodoDto,
} from './todos.types';

export class InMemoryTodosRepository implements ITodosRepository {
  private todos: PersonalTodo[] = [];

  async list(employeeId: string, query?: ListTodosQuery): Promise<ListTodosResult> {
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;

    const filtered = this.todos
      .filter((t) => {
        if (t.employeeId !== employeeId) return false;
        if (query?.completed !== undefined && t.isCompleted !== query.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return {
      data: paged,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + paged.length < total,
      },
    };
  }

  async findById(id: string, employeeId: string): Promise<PersonalTodo | null> {
    const todo = this.todos.find((t) => t.id === id && t.employeeId === employeeId);
    return todo ?? null;
  }

  async create(employeeId: string, dto: CreateTodoDto): Promise<PersonalTodo> {
    const now = new Date().toISOString();
    const todo: PersonalTodo = {
      id: crypto.randomUUID(),
      employeeId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ?? null,
      isCompleted: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.push(todo);
    return todo;
  }

  async update(id: string, employeeId: string, dto: UpdateTodoDto): Promise<PersonalTodo | null> {
    const todo = await this.findById(id, employeeId);
    if (!todo) return null;

    if (dto.title !== undefined) todo.title = dto.title;
    if (dto.description !== undefined) todo.description = dto.description ?? null;
    if (dto.dueDate !== undefined) todo.dueDate = dto.dueDate ?? null;
    if (dto.isCompleted !== undefined) {
      todo.isCompleted = dto.isCompleted;
      todo.completedAt = dto.isCompleted ? new Date().toISOString() : null;
    }
    todo.updatedAt = new Date().toISOString();
    return todo;
  }

  async toggle(id: string, employeeId: string): Promise<PersonalTodo | null> {
    const todo = await this.findById(id, employeeId);
    if (!todo) return null;
    return this.update(id, employeeId, { isCompleted: !todo.isCompleted });
  }

  async delete(id: string, employeeId: string): Promise<boolean> {
    const idx = this.todos.findIndex((t) => t.id === id && t.employeeId === employeeId);
    if (idx === -1) return false;
    this.todos.splice(idx, 1);
    return true;
  }

  // Test helper
  clear(): void {
    this.todos = [];
  }
}
