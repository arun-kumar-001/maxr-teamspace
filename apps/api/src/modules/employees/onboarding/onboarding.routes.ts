import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { publicRoute, requirePermission } from '../../rbac';
import {
  employeeStepSchema,
  listOnboardingQuerySchema,
  setPasswordSchema,
  verifyItemSchema,
} from './onboarding.schemas';
import { OnboardingService } from './onboarding.service';

const itemParamSchema = z.object({
  id: z.string().uuid(),
  itemKey: z.string().min(1).max(100),
});

const reopenBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export function createOnboardingRouter(options: {
  service: OnboardingService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();

  // Public: Set password using single-use 72h hashed token (Step 4 claim)
  router.post(
    '/set-password',
    publicRoute(),
    validate({ body: setPasswordSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: setPasswordSchema });
      const result = await options.service.setPassword(body, req.ip);
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: View own checklist for logged-in user
  router.get(
    '/me',
    options.authenticate,
    requirePermission('onboarding.read_own'),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const detail = await options.service.getMe({
        actorId: actor.id,
        employeeId: actor.employeeId,
        roles: actor.roles,
        requestId: req.id,
      });
      res.status(200).json({ data: detail });
    }),
  );

  // Authenticated: List onboarding checklists (scoped)
  router.get(
    '/',
    options.authenticate,
    requirePermission('onboarding.list'),
    validate({ query: listOnboardingQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { query } = validated(req, { query: listOnboardingQuerySchema });
      const result = await options.service.list(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        query,
      );
      res.status(200).json(result);
    }),
  );

  // Authenticated: Get single employee checklist
  router.get(
    '/:id',
    options.authenticate,
    requirePermission('onboarding.read'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });
      const detail = await options.service.get(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
      );
      res.status(200).json({ data: detail });
    }),
  );

  // Authenticated: Verify item
  router.post(
    '/:id/items/:itemKey/verify',
    options.authenticate,
    requirePermission('onboarding.verify_hr'),
    validate({ params: itemParamSchema, body: verifyItemSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params, body } = validated(req, {
        params: itemParamSchema,
        body: verifyItemSchema,
      });
      const result = await options.service.verifyItem(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        params.itemKey,
        body,
      );
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: Unverify item
  router.post(
    '/:id/items/:itemKey/unverify',
    options.authenticate,
    requirePermission('onboarding.reopen'),
    validate({ params: itemParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: itemParamSchema });
      const result = await options.service.unverifyItem(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        params.itemKey,
      );
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: Generate set-password claim link (HR/Admin)
  router.post(
    '/:id/generate-token',
    options.authenticate,
    requirePermission('onboarding.verify_hr'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });
      const result = await options.service.generateSetPasswordToken(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
      );
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: Complete employee step
  router.post(
    '/:id/employee-step',
    options.authenticate,
    requirePermission('onboarding.complete_employee'),
    validate({ params: idParamSchema, body: employeeStepSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params, body } = validated(req, {
        params: idParamSchema,
        body: employeeStepSchema,
      });
      const result = await options.service.completeEmployeeStep(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        body,
      );
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: Activate account (The Activation Gate)
  router.post(
    '/:id/activate',
    options.authenticate,
    requirePermission('onboarding.activate'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params } = validated(req, { params: idParamSchema });
      const result = await options.service.activate(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
      );
      res.status(200).json({ data: result });
    }),
  );

  // Authenticated: Reopen onboarding
  router.post(
    '/:id/reopen',
    options.authenticate,
    requirePermission('onboarding.reopen'),
    validate({ params: idParamSchema, body: reopenBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');
      const { params, body } = validated(req, {
        params: idParamSchema,
        body: reopenBodySchema,
      });
      const result = await options.service.reopen(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        body.reason,
      );
      res.status(200).json({ data: result });
    }),
  );

  return router;
}
