import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate } from '../../../http/validate';
import { PlatformServices } from '../../../platform';
import { requirePermission } from '../../rbac';
import { DepartmentController } from './department.controller';
import { IDepartmentRepository, PgDepartmentRepository } from './department.repository';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.schemas';
import { DepartmentService } from './department.service';

export interface DepartmentRouterOptions {
  idempotencyStore: IdempotencyStore;
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IDepartmentRepository;
  getPool?: () => Pool;
}

export function createDepartmentRouter(options: DepartmentRouterOptions): Router {
  const repository = options.repository ?? new PgDepartmentRepository(options.getPool ?? getPool);
  const service = new DepartmentService(repository, options.platform);
  const controller = new DepartmentController(service);

  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('departments.list'),
    validate({ query: listDepartmentsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id',
    requirePermission('departments.list'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    requirePermission('departments.create'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createDepartmentSchema }),
    asyncHandler(controller.create),
  );

  router.put(
    '/:id',
    requirePermission('departments.update'),
    validate({ params: idParamSchema, body: updateDepartmentSchema }),
    asyncHandler(controller.update),
  );

  router.post(
    '/:id/deactivate',
    requirePermission('departments.deactivate'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.deactivate),
  );

  return router;
}
