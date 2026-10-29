import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate } from '../../http/validate';
import { AuthController } from './auth.controller';
import { changePasswordSchema, loginSchema } from './auth.schemas';
import { requireSameOrigin } from './authenticate';
import { AuthConfig } from './auth-config';

export interface AuthRouterOptions {
  controller: AuthController;
  authenticate: RequestHandler;
  /** Per-IP limit for the login endpoint, on top of the per-account lockout. */
  loginRateLimiter: RequestHandler;
  config: AuthConfig;
}

/** Mounted at /api/v1/auth. Only login is public. */
export function createAuthRouter({
  controller,
  authenticate,
  loginRateLimiter,
  config,
}: AuthRouterOptions): Router {
  const router = Router();

  router.post(
    '/login',
    requireSameOrigin(config),
    loginRateLimiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );
  router.get('/me', authenticate, asyncHandler(controller.me));
  router.post('/logout', authenticate, asyncHandler(controller.logout));
  router.post(
    '/change-password',
    authenticate,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword),
  );

  return router;
}
