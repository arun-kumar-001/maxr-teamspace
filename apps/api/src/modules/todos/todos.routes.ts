import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { forbidden, unauthorized } from '../../http/errors';
import { validate, validated } from '../../http/validate';
import { requirePermission } from '../rbac';
import {
  createTodoSchema,
  listTodosQuerySchema,
  todoIdParamsSchema,
  updateTodoSchema,
} from './todos.schemas';
import { TodosService } from './todos.service';

function getEmployeeId(req: Request): string {
  const { actor } = req;
  if (!actor) throw unauthorized('Authentication required');
  if (!actor.employeeId) throw forbidden('Caller is not associated with an employee profile');
  return actor.employeeId;
}

export function createTodosRouter(service: TodosService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('todos.manage'),
    validate({ query: listTodosQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listTodosQuerySchema });
      const employeeId = getEmployeeId(req);
      const result = await service.list(employeeId, query);
      res.status(200).json(result);
    }),
  );

  router.post(
    '/',
    requirePermission('todos.manage'),
    validate({ body: createTodoSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createTodoSchema });
      const employeeId = getEmployeeId(req);
      const data = await service.create(employeeId, body);
      res.status(201).json({ data });
    }),
  );

  router.get(
    '/:id',
    requirePermission('todos.manage'),
    validate({ params: todoIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: todoIdParamsSchema });
      const employeeId = getEmployeeId(req);
      const data = await service.get(params.id, employeeId);
      res.status(200).json({ data });
    }),
  );

  router.patch(
    '/:id',
    requirePermission('todos.manage'),
    validate({ params: todoIdParamsSchema, body: updateTodoSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: todoIdParamsSchema,
        body: updateTodoSchema,
      });
      const employeeId = getEmployeeId(req);
      const data = await service.update(params.id, employeeId, body);
      res.status(200).json({ data });
    }),
  );

  router.post(
    '/:id/toggle',
    requirePermission('todos.manage'),
    validate({ params: todoIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: todoIdParamsSchema });
      const employeeId = getEmployeeId(req);
      const data = await service.toggle(params.id, employeeId);
      res.status(200).json({ data });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('todos.manage'),
    validate({ params: todoIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: todoIdParamsSchema });
      const employeeId = getEmployeeId(req);
      await service.delete(params.id, employeeId);
      res.status(204).end();
    }),
  );

  return router;
}
