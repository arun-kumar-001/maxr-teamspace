import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate } from '../../http/validate';
import { requirePermission } from '../rbac';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository, IAttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { AuditLogger } from '../../platform/audit/types';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from './attendance.schemas';

export interface AttendanceRouterOptions {
  authenticate: RequestHandler;
  audit?: AuditLogger;
  repository?: IAttendanceRepository;
  service?: AttendanceService;
}

export function createAttendanceRouter(options: AttendanceRouterOptions): Router {
  const router = Router();
  const repo = options.repository ?? new AttendanceRepository();
  const service = options.service ?? new AttendanceService(repo, options.audit);
  const controller = new AttendanceController(service);

  router.use(options.authenticate);

  router.post(
    '/check-in',
    requirePermission('attendance.check_in'),
    validate({ body: checkInSchema }),
    asyncHandler(controller.checkIn),
  );

  router.post(
    '/check-out',
    requirePermission('attendance.check_out'),
    validate({ body: checkOutSchema }),
    asyncHandler(controller.checkOut),
  );

  router.get(
    '/active',
    requirePermission('attendance.read_own'),
    asyncHandler(controller.getActive),
  );

  router.get('/today', requirePermission('attendance.read_own'), asyncHandler(controller.getToday));

  router.get(
    '/me',
    requirePermission('attendance.read_own'),
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.getMyHistory),
  );

  router.get(
    '/',
    requirePermission('attendance.list'),
    validate({ query: listAttendanceQuerySchema }),
    asyncHandler(controller.list),
  );

  return router;
}
