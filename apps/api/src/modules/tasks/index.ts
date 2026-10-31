import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import type { ProjectReader } from '../projects';
import type { CompanySettingsReader } from '../settings';
import { ITasksRepository, PgTasksRepository } from './tasks.repository';
import { createTasksRouter } from './tasks.routes';
import { TasksService } from './tasks.service';

export function createTasks(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  settings: CompanySettingsReader;
  projects: ProjectReader;
  repository?: ITasksRepository;
  getPool?: () => Pool;
  clock?: () => Date;
}): { router: Router } {
  const repository = options.repository ?? new PgTasksRepository(options.getPool ?? getPool);
  const service = new TasksService(
    repository,
    options.platform,
    options.settings,
    options.projects,
    options.clock,
  );
  return {
    router: createTasksRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}
