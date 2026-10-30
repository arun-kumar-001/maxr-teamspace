import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { requirePermission } from '../rbac';
import { TemplateController } from './template.controller';
import { ITemplateRepository, TemplateRepository } from './template.repository';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from './template.schemas';
import { TemplateService } from './template.service';

/**
 * Route order for a real module (each step plugs in left to right):
 *   authenticate -> requirePermission('module.action') -> validate -> [idempotent] -> controller
 * Mounted under /api/v1/templates by routes/index.ts (non-production only). The sample borrows the
 * employees.* permissions and treats a template's owner as an employee, so it shows every scope.
 */
export function createTemplateRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
  authenticate: RequestHandler,
  repository: ITemplateRepository = new TemplateRepository(),
): Router {
  const router = Router();
  const controller = new TemplateController(new TemplateService(repository, platform));
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('employees.list'),
    validate({ query: listTemplatesQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:id',
    requirePermission('employees.read'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getById),
  );
  router.post(
    '/',
    requirePermission('employees.create'),
    idempotent({ store: idempotencyStore }),
    validate({ body: createTemplateSchema }),
    asyncHandler(controller.create),
  );
  router.put(
    '/:id',
    requirePermission('employees.update'),
    validate({ params: idParamSchema, body: updateTemplateSchema }),
    asyncHandler(controller.update),
  );
  router.post(
    '/:id/deactivate',
    requirePermission('employees.deactivate'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.deactivate),
  );

  return router;
}
