import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { authenticatedOnly } from '../rbac';
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
    authenticatedOnly(),
    validate({ query: listApprovalsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:id',
    authenticatedOnly(),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getById),
  );
  router.post(
    '/',
    authenticatedOnly(),
    idempotent({ store: idempotencyStore }),
    validate({ body: createApprovalSchema }),
    asyncHandler(controller.create),
  );
  router.post(
    '/:id/approve',
    authenticatedOnly(),
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.approve),
  );
  router.post(
    '/:id/reject',
    authenticatedOnly(),
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.reject),
  );

  return router;
}
