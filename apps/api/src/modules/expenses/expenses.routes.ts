import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { rawUploadParser, readRawUpload } from '../../http/raw-upload';
import { validate, validated } from '../../http/validate';
import { accessFor, requirePermission, resolveScope, toScopeFilter } from '../rbac';
import {
  createCategorySchema,
  createClaimSchema,
  categoryIdParamsSchema,
  expenseIdParamsSchema,
  listClaimsQuerySchema,
  listMyClaimsQuerySchema,
} from './expenses.schemas';
import { ExpenseCaller, ExpensesService } from './expenses.service';

/** Receipts up to this size are read; the storage service applies the stricter receipt limit. */
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function caller(req: Request): ExpenseCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** Who may review a claim: the widest scope the caller holds for `expenses.list`. */
function reviewScope(req: Request) {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return toScopeFilter(resolveScope(actor.roles, 'expenses.list'), actor);
}

/**
 * Mounted at /api/v1/expense-claims and /api/v1/expense-categories. The claimant is always the
 * signed-in caller. Decisions are not here: approvers use /api/v1/approvals, which calls back into
 * the service. Static paths (`/me`, `/categories`) are declared before `/:id`.
 */
export function createExpensesRouters(options: {
  service: ExpensesService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): { claimsRouter: Router; categoriesRouter: Router } {
  const { service } = options;
  const idem = idempotent({ store: options.idempotencyStore });

  const claimsRouter = Router();
  claimsRouter.use(options.authenticate);

  claimsRouter.get(
    '/me',
    requirePermission('expenses.read_own'),
    validate({ query: listMyClaimsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listMyClaimsQuerySchema });
      res.status(200).json(await service.listMine(query, caller(req)));
    }),
  );

  claimsRouter.get(
    '/',
    requirePermission('expenses.list'),
    validate({ query: listClaimsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listClaimsQuerySchema });
      res.status(200).json(await service.list(query, accessFor(req).filter));
    }),
  );

  claimsRouter.post(
    '/',
    requirePermission('expenses.submit'),
    idem,
    validate({ body: createClaimSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createClaimSchema });
      res.status(201).json({ data: await service.create(body, caller(req)) });
    }),
  );

  claimsRouter.get(
    '/:id',
    requirePermission('expenses.read_own'),
    validate({ params: expenseIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id, caller(req), reviewScope(req)) });
    }),
  );

  claimsRouter.post(
    '/:id/receipt',
    requirePermission('expenses.submit'),
    validate({ params: expenseIdParamsSchema }),
    rawUploadParser(MAX_RECEIPT_BYTES),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      const file = readRawUpload(req);
      res.status(201).json({ data: await service.attachReceipt(params.id, file, caller(req)) });
    }),
  );

  claimsRouter.get(
    '/:id/receipt/download-link',
    requirePermission('expenses.read_own'),
    validate({ params: expenseIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      res
        .status(200)
        .json({ data: await service.receiptLink(params.id, caller(req), reviewScope(req)) });
    }),
  );

  claimsRouter.post(
    '/:id/submit',
    requirePermission('expenses.submit'),
    validate({ params: expenseIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      res.status(200).json({ data: await service.submit(params.id, caller(req)) });
    }),
  );

  claimsRouter.post(
    '/:id/cancel',
    requirePermission('expenses.submit'),
    validate({ params: expenseIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      res.status(200).json({ data: await service.cancel(params.id, caller(req)) });
    }),
  );

  claimsRouter.post(
    '/:id/reimburse',
    requirePermission('expenses.reimburse'),
    validate({ params: expenseIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: expenseIdParamsSchema });
      const scope = accessFor(req).filter;
      res.status(200).json({ data: await service.reimburse(params.id, caller(req), scope) });
    }),
  );

  const categoriesRouter = Router();
  categoriesRouter.use(options.authenticate);

  categoriesRouter.get(
    '/',
    requirePermission('expenses.read_own'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(200).json({ data: await service.listCategories() });
    }),
  );

  categoriesRouter.post(
    '/',
    requirePermission('expenses.manage_categories'),
    idem,
    validate({ body: createCategorySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createCategorySchema });
      res.status(201).json({ data: await service.createCategory(body, caller(req)) });
    }),
  );

  categoriesRouter.post(
    '/:id/deactivate',
    requirePermission('expenses.manage_categories'),
    validate({ params: categoryIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: categoryIdParamsSchema });
      res.status(200).json({ data: await service.deactivateCategory(params.id, caller(req)) });
    }),
  );

  return { claimsRouter, categoriesRouter };
}
