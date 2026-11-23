import type { RecordScope } from '@maxr/shared';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../../http/errors';
import { PermissionKey } from './permission-catalog';
import { ScopeFilter, resolveScope, toScopeFilter } from './scope';

/** What the guard decided for this request. */
export interface AccessDecision {
  permission: PermissionKey;
  scope: RecordScope;
  /** Hand this to the service and on to the repository query. */
  filter: ScopeFilter;
}

/** How a route declares its access rule; the route inventory test requires exactly one. */
export type RouteAccess =
  | { type: 'permission'; permission: PermissionKey }
  | { type: 'public' }
  | { type: 'authenticated' };

const ACCESS = Symbol.for('maxr.routeAccess');

type Tagged = RequestHandler & { [ACCESS]?: RouteAccess };

const tag = (handler: RequestHandler, access: RouteAccess): RequestHandler => {
  (handler as Tagged)[ACCESS] = access;
  return handler;
};

export const accessOf = (handler: unknown): RouteAccess | undefined =>
  typeof handler === 'function' ? (handler as Tagged)[ACCESS] : undefined;

/**
 * Put after `authenticate`. Denies by default: the route is reachable only when one of the
 * user's roles holds the permission. Sets `req.access` for the controller.
 * A missing session is a 401 here too, so a route that forgot `authenticate` still fails closed.
 */
export function requirePermission(permission: PermissionKey): RequestHandler {
  return tag(
    (req: Request, _res: Response, next: NextFunction) => {
      const actor = req.actor;
      if (!actor) {
        return next(unauthorized());
      }
      const scope = resolveScope(actor.roles, permission);
      if (!scope) {
        return next(forbidden());
      }
      req.access = { permission, scope, filter: toScopeFilter(scope, actor) };
      next();
    },
    { type: 'permission', permission },
  );
}

/** For the few routes anyone may call (login, health, signed download links). Reviewed in the inventory test. */
export const publicRoute = (): RequestHandler =>
  tag((_req, _res, next) => next(), { type: 'public' });

/** Any signed-in user, no permission needed (own session, own password). Still behind `authenticate`. */
export function authenticatedOnly(): RequestHandler {
  return tag((req, _res, next) => (req.actor ? next() : next(unauthorized())), {
    type: 'authenticated',
  });
}

/** The decision made by `requirePermission`; a controller reaching this without it is a coding error. */
export function accessFor(req: Request): AccessDecision {
  if (!req.access) {
    throw new Error('requirePermission() did not run before this handler');
  }
  return req.access;
}
