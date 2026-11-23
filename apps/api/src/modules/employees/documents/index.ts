import { RequestHandler, Router } from 'express';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import {
  IEmployeeDocumentsRepository,
  PgEmployeeDocumentsRepository,
} from './documents.repository';
import { createEmployeeDocumentsRouter } from './documents.routes';
import { EmployeeDocumentsService } from './documents.service';

export * from './documents.types';
export * from './documents.schemas';
export * from './documents.repository';
export * from './documents.service';
export * from './documents.routes';

export interface EmployeeDocumentsModule {
  router: Router;
  service: EmployeeDocumentsService;
  repository: IEmployeeDocumentsRepository;
}

export function createEmployeeDocuments(options: {
  platform: PlatformServices;
  authenticate: RequestHandler;
  repository?: IEmployeeDocumentsRepository;
}): EmployeeDocumentsModule {
  const repository = options.repository ?? new PgEmployeeDocumentsRepository(getPool());
  const service = new EmployeeDocumentsService(repository, options.platform);
  const router = createEmployeeDocumentsRouter({
    service,
    authenticate: options.authenticate,
  });

  return { router, service, repository };
}
