import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { PostgresTodosRepository } from './todos.repository';
import { createTodosRouter } from './todos.routes';
import { TodosService } from './todos.service';
import { ITodosRepository } from './todos.types';

export interface TodosModuleOptions {
  authenticate: RequestHandler;
  repository?: ITodosRepository;
  getPool?: () => Pool;
}

export function createTodos(options: TodosModuleOptions): {
  router: Router;
  service: TodosService;
} {
  const repository = options.repository ?? new PostgresTodosRepository(options.getPool ?? getPool);
  const service = new TodosService(repository);
  const router = createTodosRouter(service, options.authenticate);
  return { router, service };
}

export * from './todos.types';
export * from './todos.schemas';
export * from './todos.service';
export * from './todos.repository';
export * from './todos.repository.memory';
