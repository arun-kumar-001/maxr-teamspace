import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { IEmployeeDetailRepository, PgEmployeeDetailRepository } from './detail.repository';
import { createEmployeeDetailRouter } from './detail.routes';
import { EmployeeDetailService } from './detail.service';

/** `GET` and `PUT /employees/{id}`. Mount on `/employees` after the other employee routers. */
export function createEmployeeDetail(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IEmployeeDetailRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository =
    options.repository ?? new PgEmployeeDetailRepository(options.getPool ?? getPool);
  const service = new EmployeeDetailService(repository, options.platform);
  return {
    router: createEmployeeDetailRouter({ service, authenticate: options.authenticate }),
  };
}
