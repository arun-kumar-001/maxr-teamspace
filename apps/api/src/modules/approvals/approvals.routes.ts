import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { requirePermission } from '../rbac';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsRepository, IApprovalsRepository } from './approvals.repository';
import {
  createApprovalSchema,
  decisionSchema,
  listApprovalsQuerySchema,
} from './approvals.schemas';
import { ApprovalsService } from './approvals.service';

export function createApprovalsRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
  authenticate: RequestHandler,
  repository?: IApprovalsRepository,
): Router {
  const router = Router();
  router.use(authenticate);

  const controller = new ApprovalsController(
    new ApprovalsService(repository ?? new ApprovalsRepository(), platform),
  );

  router.get(
    '/',
    requirePermission('approvals.list'),
    validate({ query: listApprovalsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:id',
    requirePermission('approvals.read'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getById),
  );
  router.post(
    '/',
    requirePermission('approvals.create'),
    idempotent({ store: idempotencyStore }),
    validate({ body: createApprovalSchema }),
    asyncHandler(controller.create),
  );
  router.post(
    '/:id/approve',
    requirePermission('approvals.decide'),
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.approve),
  );
  router.post(
    '/:id/reject',
    requirePermission('approvals.decide'),
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.reject),
  );

  return router;
}
