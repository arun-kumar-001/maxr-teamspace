import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate } from '../../http/validate';
import { requirePermission } from '../rbac';
import { SettingsController } from './settings.controller';
import { updateSettingsSchema } from './settings.schemas';
import { SettingsService } from './settings.service';

/** Mounted at /api/v1/settings. */
export function createSettingsRouter(
  service: SettingsService,
  authenticate: RequestHandler,
): Router {
  const controller = new SettingsController(service);
  const router = Router();
  router.use(authenticate);

  router.get('/', requirePermission('settings.read'), asyncHandler(controller.get));
  router.get('/basic', requirePermission('settings.read_basic'), asyncHandler(controller.getBasic));
  router.put(
    '/',
    requirePermission('settings.update'),
    validate({ body: updateSettingsSchema }),
    asyncHandler(controller.update),
  );

  return router;
}
