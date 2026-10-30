import { RequestHandler, Router } from 'express';
import { getPool } from '../../../db/client';
import { validate } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import { EmployeeDirectoryController } from './directory.controller';
import {
  IEmployeeDirectoryRepository,
  PgEmployeeDirectoryRepository,
} from './directory.repository';
import { employeeDirectoryQuerySchema } from './directory.schemas';
import { EmployeeDirectoryService } from './directory.service';

export interface EmployeeDirectoryRouterOptions {
  authenticate: RequestHandler;
  repository?: IEmployeeDirectoryRepository;
}

export function createEmployeeDirectoryRouter(options: EmployeeDirectoryRouterOptions): Router {
  const router = Router();
  const repo = options.repository ?? new PgEmployeeDirectoryRepository(getPool);
  const service = new EmployeeDirectoryService(repo);
  const controller = new EmployeeDirectoryController(service);

  router.get(
    '/',
    options.authenticate,
    requirePermission('employees.list'),
    validate({ query: employeeDirectoryQuerySchema }),
    controller.list,
  );

  return router;
}
