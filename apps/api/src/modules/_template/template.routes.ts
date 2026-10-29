import { idParamSchema } from '@maxr/shared';
import { Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, InMemoryIdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { TemplateController } from './template.controller';
import { TemplateRepository } from './template.repository';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from './template.schemas';
import { TemplateService } from './template.service';

/**
 * Route order for a real module (each step plugs in left to right):
 *   authenticate (#7) -> requirePermission('module.action') (#8) -> validate -> [idempotent] -> controller
 * Mounted under /api/v1/templates by routes/index.ts (non-production only).
 */
export function createTemplateRouter(
  idempotencyStore: IdempotencyStore = new InMemoryIdempotencyStore(),
): Router {
  const router = Router();
  const controller = new TemplateController(new TemplateService(new TemplateRepository()));

  router.get('/', validate({ query: listTemplatesQuerySchema }), asyncHandler(controller.list));
  router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getById));
  router.post(
    '/',
    idempotent({ store: idempotencyStore }),
    validate({ body: createTemplateSchema }),
    asyncHandler(controller.create),
  );
  router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateTemplateSchema }),
    asyncHandler(controller.update),
  );
  router.post(
    '/:id/deactivate',
    validate({ params: idParamSchema }),
    asyncHandler(controller.deactivate),
  );

  return router;
}
