import { idParamSchema } from '@maxr/shared';
import { Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsRepository } from './approvals.repository';
import {
  createApprovalSchema,
  decisionSchema,
  listApprovalsQuerySchema,
} from './approvals.schemas';
import { ApprovalsService } from './approvals.service';

export function createApprovalsRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
): Router {
  const router = Router();
  const controller = new ApprovalsController(
    new ApprovalsService(new ApprovalsRepository(), platform),
  );

  router.get('/', validate({ query: listApprovalsQuerySchema }), asyncHandler(controller.list));
  router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getById));
  router.post(
    '/',
    idempotent({ store: idempotencyStore }),
    validate({ body: createApprovalSchema }),
    asyncHandler(controller.create),
  );
  router.post(
    '/:id/approve',
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.approve),
  );
  router.post(
    '/:id/reject',
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: decisionSchema }),
    asyncHandler(controller.reject),
  );

  return router;
}
