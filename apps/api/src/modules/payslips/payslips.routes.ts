import { Request, RequestHandler, Response, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { asyncHandler } from '../../http/async-handler';
import { unauthorized } from '../../http/errors';
import { validate, validated } from '../../http/validate';
import type { AuditLogger } from '../../platform/audit/types';
import { requirePermission } from '../rbac';
import { type IPayslipsRepository, PgPayslipsRepository } from './payslips.repository';
import {
  createPayslipSchema,
  listPayslipsQuerySchema,
  payslipIdParamsSchema,
  updatePayslipSchema,
} from './payslips.schemas';
import { PayslipsService } from './payslips.service';
import type { PayslipCaller } from './payslips.types';

function callerFrom(req: Request): PayslipCaller {
  const { actor } = req;
  if (!actor) throw unauthorized('Authentication is required');
  return {
    actorId: actor.id,
    actorRole: actor.role,
    employeeId: actor.employeeId,
    requestId: req.id,
  };
}

export interface PayslipsRouterOptions {
  authenticate: RequestHandler;
  audit?: AuditLogger;
  repository?: IPayslipsRepository;
  service?: PayslipsService;
  getPool?: () => Pool;
}

export function createPayslipsRouter(options: PayslipsRouterOptions): Router {
  const router = Router();
  const repo = options.repository ?? new PgPayslipsRepository(options.getPool ?? getPool);
  const service = options.service ?? new PayslipsService(repo, options.audit);

  router.use(options.authenticate);

  router.get(
    '/me',
    requirePermission('payslips.read_own'),
    validate({ query: listPayslipsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listPayslipsQuerySchema });
      const result = await service.listMine(query, callerFrom(req));
      res.status(200).json(result);
    }),
  );

  router.get(
    '/',
    requirePermission('payslips.read_all'),
    validate({ query: listPayslipsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listPayslipsQuerySchema });
      const result = await service.listAll(query);
      res.status(200).json(result);
    }),
  );

  router.post(
    '/',
    requirePermission('payslips.manage'),
    validate({ body: createPayslipSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createPayslipSchema });
      const created = await service.create(body, callerFrom(req));
      res.status(201).json({ data: created });
    }),
  );

  router.get(
    '/:id/pdf',
    requirePermission('payslips.read_own'),
    validate({ params: payslipIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: payslipIdParamsSchema });
      const { buffer, filename } = await service.downloadPdf(params.id, callerFrom(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buffer);
    }),
  );

  router.get(
    '/:id',
    requirePermission('payslips.read_own'),
    validate({ params: payslipIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: payslipIdParamsSchema });
      const record = await service.getById(params.id, callerFrom(req));
      res.status(200).json({ data: record });
    }),
  );

  router.put(
    '/:id',
    requirePermission('payslips.manage'),
    validate({ params: payslipIdParamsSchema, body: updatePayslipSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: payslipIdParamsSchema,
        body: updatePayslipSchema,
      });
      const updated = await service.update(params.id, body, callerFrom(req));
      res.status(200).json({ data: updated });
    }),
  );

  router.post(
    '/:id/publish',
    requirePermission('payslips.manage'),
    validate({ params: payslipIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: payslipIdParamsSchema });
      const published = await service.publish(params.id, callerFrom(req));
      res.status(200).json({ data: published });
    }),
  );

  return router;
}
