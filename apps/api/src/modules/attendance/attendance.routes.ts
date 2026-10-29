import { Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from './attendance.schemas';
import { AttendanceService } from './attendance.service';

export function createAttendanceRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
): Router {
  const router = Router();
  const controller = new AttendanceController(
    new AttendanceService(new AttendanceRepository(), platform),
  );

  router.get('/active', asyncHandler(controller.getActive));
  router.get('/today', asyncHandler(controller.getToday));
  router.post(
    '/check-in',
    idempotent({ store: idempotencyStore }),
    validate({ body: checkInSchema }),
    asyncHandler(controller.checkIn),
  );
  router.post(
    '/check-out',
    idempotent({ store: idempotencyStore }),
    validate({ body: checkOutSchema }),
    asyncHandler(controller.checkOut),
  );
  router.get(
    '/history',
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.listHistory),
  );

  return router;
}
