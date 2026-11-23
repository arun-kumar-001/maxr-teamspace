import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { IDeactivationRepository, PgDeactivationRepository } from './deactivation.repository';
import { createEmployeeDeactivationRouter } from './deactivation.routes';
import { EmployeeDeactivationService } from './deactivation.service';
import type { SessionRevoker } from './deactivation.types';

/** `POST /employees/{id}/deactivate`. Mount on `/employees` after the other employee routers. */
export function createEmployeeDeactivation(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  /** The auth module's session service. */
  sessions: SessionRevoker;
  repository?: IDeactivationRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository = options.repository ?? new PgDeactivationRepository(options.getPool ?? getPool);
  const service = new EmployeeDeactivationService(repository, options.platform, options.sessions);
  return {
    router: createEmployeeDeactivationRouter({ service, authenticate: options.authenticate }),
  };
}
