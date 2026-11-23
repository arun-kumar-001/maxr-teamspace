import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { IHierarchyRepository, PgHierarchyRepository } from './hierarchy.repository';
import { createHierarchyRouter } from './hierarchy.routes';
import { HierarchyService } from './hierarchy.service';

/** Reporting hierarchy routes. Mount on `/employees` BEFORE the detail router. */
export function createEmployeeHierarchy(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IHierarchyRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository = options.repository ?? new PgHierarchyRepository(options.getPool ?? getPool);
  const service = new HierarchyService(repository, options.platform);
  return { router: createHierarchyRouter({ service, authenticate: options.authenticate }) };
}
