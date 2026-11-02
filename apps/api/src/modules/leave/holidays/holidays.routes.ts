import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import {
  createHolidaySchema,
  holidayIdParamsSchema,
  listHolidaysQuerySchema,
} from './holidays.schemas';
import { HolidayCaller, HolidaysService } from './holidays.service';

function caller(req: Request): HolidayCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, requestId: req.id };
}

/** Mounted at /api/v1/holidays. Everyone reads the calendar; HR and Admin maintain it. */
export function createHolidaysRouter(options: {
  service: HolidaysService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('holidays.read'),
    validate({ query: listHolidaysQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listHolidaysQuerySchema });
      res.status(200).json({ data: await service.list(query.year) });
    }),
  );

  router.post(
    '/',
    requirePermission('holidays.manage'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createHolidaySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createHolidaySchema });
      res.status(201).json({ data: await service.create(body, caller(req)) });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('holidays.manage'),
    validate({ params: holidayIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: holidayIdParamsSchema });
      res.status(200).json({ data: await service.remove(params.id, caller(req)) });
    }),
  );

  return router;
}
