import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate } from '../../../http/validate';
import { PlatformServices } from '../../../platform';
import { requirePermission } from '../../rbac';
import { DesignationController } from './designation.controller';
import { IDesignationRepository, PgDesignationRepository } from './designation.repository';
import {
  createDesignationSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas';
import { DesignationService } from './designation.service';

export interface DesignationRouterOptions {
  idempotencyStore: IdempotencyStore;
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IDesignationRepository;
  getPool?: () => Pool;
}

export function createDesignationRouter(options: DesignationRouterOptions): Router {
  const repository = options.repository ?? new PgDesignationRepository(options.getPool ?? getPool);
  const service = new DesignationService(repository, options.platform);
  const controller = new DesignationController(service);

  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('designations.list'),
    validate({ query: listDesignationsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id',
    requirePermission('designations.list'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    requirePermission('designations.create'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createDesignationSchema }),
    asyncHandler(controller.create),
  );

  router.put(
    '/:id',
    requirePermission('designations.update'),
    validate({ params: idParamSchema, body: updateDesignationSchema }),
    asyncHandler(controller.update),
  );

  router.post(
    '/:id/deactivate',
    requirePermission('designations.deactivate'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.deactivate),
  );

  return router;
}
