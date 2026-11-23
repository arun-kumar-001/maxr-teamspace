import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate, validated } from '../../http/validate';
import { requirePermission } from '../rbac';
import {
  announceSchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from './notifications.schemas';
import { NotificationCaller, NotificationsService } from './notifications.service';

function caller(req: Request): NotificationCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/**
 * Mounted at /api/v1/notifications. Everything here is about the signed-in caller's own inbox:
 * no route takes a recipient. `/read-all` and `/announcements` are fixed paths, declared before
 * the ones with an id.
 */
export function createNotificationsRouter(options: {
  service: NotificationsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('notifications.read_own'),
    validate({ query: listNotificationsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listNotificationsQuerySchema });
      res.status(200).json(await service.list(query, caller(req)));
    }),
  );

  router.post(
    '/read-all',
    requirePermission('notifications.read_own'),
    asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json({ data: await service.markAllRead(caller(req)) });
    }),
  );

  router.post(
    '/announcements',
    requirePermission('notifications.announce'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: announceSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: announceSchema });
      res.status(201).json({ data: await service.announce(body, caller(req)) });
    }),
  );

  router.post(
    '/:id/read',
    requirePermission('notifications.read_own'),
    validate({ params: notificationIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: notificationIdParamsSchema });
      res.status(200).json({ data: await service.markRead(params.id, caller(req)) });
    }),
  );

  return router;
}
