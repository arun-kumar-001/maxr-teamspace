export interface PersonalTodo {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  isCompleted?: boolean;
}

export interface ListTodosQuery {
  completed?: boolean;
  limit?: number;
  offset?: number;
}

export interface TodosPaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ListTodosResult {
  data: PersonalTodo[];
  meta: TodosPaginationMeta;
}

export interface ITodosRepository {
  list(employeeId: string, query?: ListTodosQuery): Promise<ListTodosResult>;
  findById(id: string, employeeId: string): Promise<PersonalTodo | null>;
  create(employeeId: string, dto: CreateTodoDto): Promise<PersonalTodo>;
  update(id: string, employeeId: string, dto: UpdateTodoDto): Promise<PersonalTodo | null>;
  toggle(id: string, employeeId: string): Promise<PersonalTodo | null>;
  delete(id: string, employeeId: string): Promise<boolean>;
}
