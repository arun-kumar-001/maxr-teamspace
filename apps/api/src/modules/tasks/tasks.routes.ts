import { RECORD_SCOPES } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate, validated } from '../../http/validate';
import { requirePermission, resolveScope } from '../rbac';
import {
  changeStatusSchema,
  createTaskSchema,
  listMyTasksQuerySchema,
  listTeamTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from './tasks.schemas';
import { TaskCaller, TasksService } from './tasks.service';
import { TaskViewer } from './tasks.types';

function caller(req: Request): TaskCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** An Admin sees every task; anyone else the ones they are party to or whose assignee they manage. */
function viewer(req: Request): TaskViewer {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return {
    employeeId: actor.employeeId,
    all: resolveScope(actor.roles, 'tasks.read_team') === RECORD_SCOPES.ALL,
  };
}

/**
 * Mounted at /api/v1/tasks. The assigner is always the signed-in caller; the assignee is checked
 * on the server against the caller's team. `/me` is declared before `/:id`.
 */
export function createTasksRouter(options: {
  service: TasksService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  /** Comment and attachment routes, mounted under the same path after the task routes. */
  collaboration?: Router;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.post(
    '/',
    requirePermission('tasks.create'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createTaskSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createTaskSchema });
      res.status(201).json({ data: await service.create(body, caller(req), viewer(req)) });
    }),
  );

  router.get(
    '/me',
    requirePermission('tasks.read_own'),
    validate({ query: listMyTasksQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listMyTasksQuerySchema });
      res.status(200).json(await service.listMine(query, caller(req)));
    }),
  );

  router.get(
    '/',
    requirePermission('tasks.read_team'),
    validate({ query: listTeamTasksQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listTeamTasksQuerySchema });
      res.status(200).json(await service.listTeam(query, viewer(req)));
    }),
  );

  router.get(
    '/:id',
    requirePermission('tasks.read_own'),
    validate({ params: taskIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: taskIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id, viewer(req)) });
    }),
  );

  router.put(
    '/:id',
    requirePermission('tasks.create'),
    validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: taskIdParamsSchema,
        body: updateTaskSchema,
      });
      res
        .status(200)
        .json({ data: await service.update(params.id, body, caller(req), viewer(req)) });
    }),
  );

  router.post(
    '/:id/status',
    requirePermission('tasks.update_status'),
    validate({ params: taskIdParamsSchema, body: changeStatusSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: taskIdParamsSchema,
        body: changeStatusSchema,
      });
      res.status(200).json({
        data: await service.changeStatus(params.id, body.status, caller(req), viewer(req)),
      });
    }),
  );

  if (options.collaboration) router.use(options.collaboration);

  return router;
}
