import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore } from '../../http/idempotency';
import { rawUploadParser, readRawUpload } from '../../http/raw-upload';
import { validate, validated } from '../../http/validate';
import { requirePermission, resolveScope, toScopeFilter } from '../rbac';
import {
  createExpenseCategorySchema,
  createExpenseClaimSchema,
  listExpenseClaimsQuerySchema,
  updateExpenseCategorySchema,
} from './expenses.schemas';
import { ExpensesService } from './expenses.service';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

export function createExpensesRouter(options: {
  service: ExpensesService;
  authenticate: RequestHandler;
  idempotencyStore?: IdempotencyStore;
}): Router {
  const router = Router();

  // GET /expense-categories - Active categories (public to all authenticated users)
  router.get(
    '/expense-categories',
    options.authenticate,
    requirePermission('expenses.read_categories'),
    asyncHandler(async (_req: Request, res: Response) => {
      const categories = await options.service.listCategories(true);
      res.status(200).json({ data: categories });
    }),
  );

  // POST /expense-categories - Create category (HR/Admin)
  router.post(
    '/expense-categories',
    options.authenticate,
    requirePermission('expenses.manage_categories'),
    validate({ body: createExpenseCategorySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { body } = validated(req, { body: createExpenseCategorySchema });

      const category = await options.service.createCategory(body, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });

      res.status(201).json({ data: category });
    }),
  );

  // PUT /expense-categories/:id - Update category (HR/Admin)
  router.put(
    '/expense-categories/:id',
    options.authenticate,
    requirePermission('expenses.manage_categories'),
    validate({ params: idParamSchema, body: updateExpenseCategorySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params, body } = validated(req, {
        params: idParamSchema,
        body: updateExpenseCategorySchema,
      });

      const category = await options.service.updateCategory(params.id, body, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });

      res.status(200).json({ data: category });
    }),
  );

  // GET /expense-claims/mine - List caller's own claims
  router.get(
    '/expense-claims/mine',
    options.authenticate,
    requirePermission('expenses.submit'),
    validate({ query: listExpenseClaimsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { query } = validated(req, { query: listExpenseClaimsQuerySchema });

      const page = await options.service.listMyClaims(query, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });

      res.status(200).json(page);
    }),
  );

  // GET /expense-claims - List claims within caller's scope
  router.get(
    '/expense-claims',
    options.authenticate,
    requirePermission('expenses.list'),
    validate({ query: listExpenseClaimsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { query } = validated(req, { query: listExpenseClaimsQuerySchema });

      const scope = resolveScope(actor.roles, 'expenses.list');
      const filter = toScopeFilter(scope, actor);

      const page = await options.service.listClaims(
        query,
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        filter,
      );

      res.status(200).json(page);
    }),
  );

  // POST /expense-claims - Submit claim (JSON)
  router.post(
    '/expense-claims',
    options.authenticate,
    requirePermission('expenses.submit'),
    validate({ body: createExpenseClaimSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { body } = validated(req, { body: createExpenseClaimSchema });

      let receipt: { filename: string; declaredType: string; body: Buffer } | undefined;

      if (body.receipt) {
        receipt = {
          filename: body.receipt.filename,
          declaredType: body.receipt.declaredType,
          body: Buffer.from(body.receipt.base64, 'base64'),
        };
      }

      const claim = await options.service.submitClaim(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        {
          categoryId: body.categoryId,
          amountPaise: body.amountPaise,
          expenseDate: body.expenseDate,
          description: body.description,
          receipt,
        },
      );

      res.status(201).json({ data: claim });
    }),
  );

  // POST /expense-claims/raw - Submit claim via raw upload (binary body + headers)
  router.post(
    '/expense-claims/raw',
    options.authenticate,
    requirePermission('expenses.submit'),
    rawUploadParser(MAX_RECEIPT_BYTES),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');

      const raw = readRawUpload(req);
      const categoryId =
        (req.header('x-category-id') as string) || (req.query.categoryId as string);
      const amountPaise = Number(
        (req.header('x-amount-paise') as string) || (req.query.amountPaise as string),
      );
      const expenseDate =
        (req.header('x-expense-date') as string) || (req.query.expenseDate as string);
      const rawDesc =
        (req.header('x-description') as string) || (req.query.description as string) || '';
      const description = decodeURIComponent(rawDesc);

      const claim = await options.service.submitClaim(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        {
          categoryId,
          amountPaise,
          expenseDate,
          description,
          receipt: {
            filename: raw.filename,
            declaredType: raw.declaredType,
            body: raw.body,
          },
        },
      );

      res.status(201).json({ data: claim });
    }),
  );

  // GET /expense-claims/:id - Claim details
  router.get(
    '/expense-claims/:id',
    options.authenticate,
    requirePermission('expenses.read'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });

      const scope = resolveScope(actor.roles, 'expenses.read');
      const filter = toScopeFilter(scope, actor);

      const claim = await options.service.getClaim(
        params.id,
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        filter,
      );

      res.status(200).json({ data: claim });
    }),
  );

  // POST /expense-claims/:id/cancel - Cancel own submitted claim
  router.post(
    '/expense-claims/:id/cancel',
    options.authenticate,
    requirePermission('expenses.cancel'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });

      const cancelled = await options.service.cancelClaim(params.id, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });

      res.status(200).json({ data: cancelled });
    }),
  );

  // POST /expense-claims/:id/reimburse - Mark approved claim as reimbursed (HR/Admin)
  router.post(
    '/expense-claims/:id/reimburse',
    options.authenticate,
    requirePermission('expenses.reimburse'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });

      const reimbursed = await options.service.reimburseClaim(params.id, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });

      res.status(200).json({ data: reimbursed });
    }),
  );

  // GET /expense-claims/:id/receipt - Generate signed download link for receipt
  router.get(
    '/expense-claims/:id/receipt',
    options.authenticate,
    requirePermission('expenses.read'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });

      const scope = resolveScope(actor.roles, 'expenses.read');
      const filter = toScopeFilter(scope, actor);

      const link = await options.service.createReceiptDownloadLink(
        params.id,
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        filter,
      );

      res.status(200).json({ data: link });
    }),
  );

  return router;
}
