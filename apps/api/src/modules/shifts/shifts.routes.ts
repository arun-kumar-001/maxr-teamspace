import { idParamSchema } from '@maxr/shared';
import { Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate } from '../../http/validate';
import { PlatformServices } from '../../platform';
import { ShiftsController } from './shifts.controller';
import { ShiftsRepository } from './shifts.repository';
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
): Router {
  const router = Router();
  const controller = new ShiftsController(new ShiftsService(new ShiftsRepository(), platform));

  router.get('/policies', asyncHandler(controller.getPolicy));
  router.put(
    '/policies',
    validate({ body: updateAttendancePolicySchema }),
    asyncHandler(controller.updatePolicy),
  );
  router.get('/assignments/:employeeId', asyncHandler(controller.getEmployeeShifts));
  router.post(
    '/assignments',
    idempotent({ store: idempotencyStore }),
    validate({ body: assignEmployeeShiftSchema }),
    asyncHandler(controller.assignShift),
  );
  router.get('/', validate({ query: listShiftsQuerySchema }), asyncHandler(controller.listShifts));
  router.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getShiftById));
  router.post(
    '/',
    idempotent({ store: idempotencyStore }),
    validate({ body: createShiftSchema }),
    asyncHandler(controller.createShift),
  );
  router.put(
    '/:id',
    idempotent({ store: idempotencyStore }),
    validate({ params: idParamSchema, body: updateShiftSchema }),
    asyncHandler(controller.updateShift),
  );

  return router;
}
