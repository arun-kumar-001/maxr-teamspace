import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import type { ProjectReader } from '../projects';
import type { CompanySettingsReader } from '../settings';
import { getLogger } from '../../logging/logger';
import {
  ICollaborationRepository,
  PgCollaborationRepository,
} from './collaboration/collaboration.repository';
import { createCollaborationRouter } from './collaboration/collaboration.routes';
import { TaskCollaborationService } from './collaboration/collaboration.service';
import { ITasksRepository, PgTasksRepository } from './tasks.repository';
import { createTasksRouter } from './tasks.routes';
import { TasksService } from './tasks.service';

export function createTasks(options: {
  platform: Pick<PlatformServices, 'audit' | 'events' | 'storage'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  settings: CompanySettingsReader;
  projects: ProjectReader;
  repository?: ITasksRepository;
  collaborationRepository?: ICollaborationRepository;
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
  const collaboration = new TaskCollaborationService(
    options.collaborationRepository ?? new PgCollaborationRepository(options.getPool ?? getPool),
    options.platform,
    service,
    getLogger(),
  );
  return {
    router: createTasksRouter({
      service,
      collaboration: createCollaborationRouter({ service: collaboration }),
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}
