import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import { IProjectsRepository, PgProjectsRepository } from './projects.repository';
import { createProjectsRouter } from './projects.routes';
import { ProjectsService } from './projects.service';

export type { ProjectAccess, ProjectReader } from './projects.types';

export interface ProjectsServices {
  /** Mount at /api/v1/projects. */
  router: Router;
  /** For tasks: who can see and work on a project. */
  reader: import('./projects.types').ProjectReader;
}

export function createProjects(options: {
  platform: Pick<PlatformServices, 'audit'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  repository?: IProjectsRepository;
  getPool?: () => Pool;
}): ProjectsServices {
  const repository = options.repository ?? new PgProjectsRepository(options.getPool ?? getPool);
  const service = new ProjectsService(repository, options.platform);
  return {
    reader: service,
    router: createProjectsRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}
