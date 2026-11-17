import { notFound } from '../../http/errors';
import {
  CreateTodoDto,
  ITodosRepository,
  ListTodosQuery,
  ListTodosResult,
  PersonalTodo,
  UpdateTodoDto,
} from './todos.types';

export class TodosService {
  constructor(private readonly repository: ITodosRepository) {}

  async list(employeeId: string, query?: ListTodosQuery): Promise<ListTodosResult> {
    return this.repository.list(employeeId, query);
  }

  async get(id: string, employeeId: string): Promise<PersonalTodo> {
    const todo = await this.repository.findById(id, employeeId);
    if (!todo) throw notFound('To-do item not found');
    return todo;
  }

  async create(employeeId: string, dto: CreateTodoDto): Promise<PersonalTodo> {
    return this.repository.create(employeeId, dto);
  }

  async update(id: string, employeeId: string, dto: UpdateTodoDto): Promise<PersonalTodo> {
    const updated = await this.repository.update(id, employeeId, dto);
    if (!updated) throw notFound('To-do item not found');
    return updated;
  }

  async toggle(id: string, employeeId: string): Promise<PersonalTodo> {
    const toggled = await this.repository.toggle(id, employeeId);
    if (!toggled) throw notFound('To-do item not found');
    return toggled;
  }

  async delete(id: string, employeeId: string): Promise<void> {
    const deleted = await this.repository.delete(id, employeeId);
    if (!deleted) throw notFound('To-do item not found');
  }
}
