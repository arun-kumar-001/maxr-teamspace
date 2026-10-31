import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate, validated } from '../../http/validate';
import { accessFor, requirePermission } from '../rbac';
import {
  assignShiftSchema,
  createShiftSchema,
  employeeIdParamsSchema,
  listShiftsQuerySchema,
  shiftIdParamsSchema,
  updatePolicySchema,
  updateShiftSchema,
} from './shifts.schemas';
import { ShiftsCaller, ShiftsService } from './shifts.service';

function caller(req: Request): ShiftsCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** Mounted at /api/v1/shifts. `assignments` routes come before `/:id`. */
export function createShiftsRouter(options: {
  service: ShiftsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const router = Router();
  const { service, authenticate, idempotencyStore } = options;
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('shifts.list'),
    validate({ query: listShiftsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listShiftsQuerySchema });
      res.status(200).json({ data: await service.listShifts(query) });
    }),
  );

  router.post(
    '/',
    requirePermission('shifts.create'),
    idempotent({ store: idempotencyStore }),
    validate({ body: createShiftSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createShiftSchema });
      res.status(201).json({ data: await service.createShift(body, caller(req)) });
    }),
  );

  router.get(
    '/assignments/:employeeId',
    requirePermission('shifts.read_assignment'),
    validate({ params: employeeIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: employeeIdParamsSchema });
      res.status(200).json({
        data: await service.listAssignments(params.employeeId, accessFor(req).filter, caller(req)),
      });
    }),
  );

  router.post(
    '/assignments',
    requirePermission('shifts.assign'),
    idempotent({ store: idempotencyStore }),
    validate({ body: assignShiftSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: assignShiftSchema });
      res.status(201).json({ data: await service.assign(body, caller(req)) });
    }),
  );

  router.get(
    '/:id',
    requirePermission('shifts.list'),
    validate({ params: shiftIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: shiftIdParamsSchema });
      res.status(200).json({ data: await service.getShift(params.id) });
    }),
  );

  router.put(
    '/:id',
    requirePermission('shifts.update'),
    validate({ params: shiftIdParamsSchema, body: updateShiftSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: shiftIdParamsSchema,
        body: updateShiftSchema,
      });
      res.status(200).json({ data: await service.updateShift(params.id, body, caller(req)) });
    }),
  );

  return router;
}

/** Mounted at /api/v1/attendance/policies, before the attendance router. */
export function createPolicyRouter(options: {
  service: ShiftsService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const { service, authenticate } = options;
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('attendance_policies.read'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(200).json({ data: await service.getPolicy() });
    }),
  );

  router.put(
    '/',
    requirePermission('attendance_policies.update'),
    validate({ body: updatePolicySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: updatePolicySchema });
      res.status(200).json({ data: await service.updatePolicy(body, caller(req)) });
    }),
  );

  return router;
}
