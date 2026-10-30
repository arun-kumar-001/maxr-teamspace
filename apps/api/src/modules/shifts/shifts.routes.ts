import { idParamSchema } from '@maxr/shared';
import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { requirePermission } from '../rbac';
import { ShiftsController } from './shifts.controller';
import { IShiftsRepository, ShiftsRepository } from './shifts.repository';
import {
  assignEmployeeShiftSchema,
  createShiftSchema,
  listShiftsQuerySchema,
  updateAttendancePolicySchema,
  updateShiftSchema,
} from './shifts.schemas';
import { ShiftsService } from './shifts.service';

export function createShiftsRouter(
  idempotencyStore: IdempotencyStore,
  platform: Pick<PlatformServices, 'audit' | 'events'>,
  authenticate: RequestHandler,
  repository?: IShiftsRepository,
): Router {
  const router = Router();
  router.use(authenticate);

  const controller = new ShiftsController(
    new ShiftsService(repository ?? new ShiftsRepository(), platform),
  );

  router.get(
    '/policies',
    requirePermission('attendance_policies.read'),
    asyncHandler(controller.getPolicy),
  );
  router.put(
    '/policies',
    requirePermission('attendance_policies.update'),
    validate({ body: updateAttendancePolicySchema }),
    asyncHandler(controller.updatePolicy),
  );
  router.get(
    '/assignments/:employeeId',
    requirePermission('shifts.read_assignment'),
    asyncHandler(controller.listEmployeeShifts),
  );
  router.post(
    '/assignments',
    requirePermission('shifts.assign'),
    idempotent({ store: idempotencyStore }),
    validate({ body: assignEmployeeShiftSchema }),
    asyncHandler(controller.assignShift),
  );
  router.get(
    '/',
    requirePermission('shifts.list'),
    validate({ query: listShiftsQuerySchema }),
    asyncHandler(controller.listShifts),
  );
  router.get(
    '/:id',
    requirePermission('shifts.list'),
    validate({ params: idParamSchema }),
    asyncHandler(controller.getShiftById),
  );
  router.post(
    '/',
    requirePermission('shifts.create'),
    idempotent({ store: idempotencyStore }),
    validate({ body: createShiftSchema }),
    asyncHandler(controller.createShift),
  );
  router.put(
    '/:id',
    requirePermission('shifts.update'),
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: updateShiftSchema }),
    asyncHandler(controller.updateShift),
  );

  return router;
}
