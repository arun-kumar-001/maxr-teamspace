import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { authenticatedOnly } from '../rbac';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository, IAttendanceRepository } from './attendance.repository';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from './attendance.schemas';
import { AttendanceService } from './attendance.service';

export function createAttendanceRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
  authenticate: RequestHandler,
  repository?: IAttendanceRepository,
): Router {
  const router = Router();
  router.use(authenticate);

  const controller = new AttendanceController(
    new AttendanceService(repository ?? new AttendanceRepository(), platform),
  );

  router.get('/active', authenticatedOnly(), asyncHandler(controller.getActive));
  router.get('/today', authenticatedOnly(), asyncHandler(controller.getToday));
  router.get(
    '/me',
    authenticatedOnly(),
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.getMyHistory),
  );
  router.get(
    '/',
    authenticatedOnly(),
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.list),
  );
  router.post(
    '/check-in',
    authenticatedOnly(),
    idempotent({ store: idempotencyStore }),
    validate({ body: checkInSchema }),
    asyncHandler(controller.checkIn),
  );
  router.post(
    '/check-out',
    authenticatedOnly(),
    idempotent({ store: idempotencyStore }),
    validate({ body: checkOutSchema }),
    asyncHandler(controller.checkOut),
  );
  router.get(
    '/history',
    authenticatedOnly(),
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.listHistory),
  );

  return router;
}
