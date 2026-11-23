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

export interface CreateTodoInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  isCompleted?: boolean;
}

export interface TodosPaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ListTodosResponse {
  data: PersonalTodo[];
  meta: TodosPaginationMeta;
}
