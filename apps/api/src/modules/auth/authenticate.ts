import { timingSafeEqual } from 'node:crypto';
import { ERROR_CODES, type Role } from '@maxr/shared';
import { CookieOptions, Request, RequestHandler, Response } from 'express';
import { AppError } from '../../http/app-error';
import { unauthorized } from '../../http/errors';
import { AuthConfig } from './auth-config';
import { AuthRepository } from './auth.types';
import { toRoles } from './auth.service';
import { SessionService } from './session-service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sessionCookieOptions(config: AuthConfig, maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    // Only API calls carry the session, never page or asset requests.
    path: '/api',
    ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
  };
}

/** Reads one cookie without a cookie-parser dependency. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

const csrfError = () => new AppError(403, ERROR_CODES.FORBIDDEN, 'Invalid or missing CSRF token');

function sameToken(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const originError = () => new AppError(403, ERROR_CODES.FORBIDDEN, 'Request origin is not allowed');

/**
 * Browser-origin check for state-changing requests: when the browser says where the request
 * came from, it must be our own site. (SameSite=Lax cookies and the CSRF token are the other layers.)
 */
export function requireSameOrigin(config: Pick<AuthConfig, 'allowedOrigin'>): RequestHandler {
  return (req, _res, next) => {
    const origin = req.headers.origin;
    const foreign = origin !== undefined && origin !== config.allowedOrigin;
    next(!SAFE_METHODS.has(req.method) && foreign ? originError() : undefined);
  };
}

/**
 * Authenticates a request from its session cookie and sets `req.actor`. For POST, PUT and DELETE
 * it first checks the browser origin and then the CSRF token. The account is loaded on every
 * request, so a deactivated user or a changed role takes effect immediately even if a session
 * were somehow still alive.
 */
export function createAuthenticate(
  sessions: SessionService,
  repo: AuthRepository,
  config: AuthConfig,
): RequestHandler {
  const authenticate = async (req: Request, res: Response): Promise<void> => {
    const unsafe = !SAFE_METHODS.has(req.method);
    // Origin first, so a cross-site request learns nothing about whether a session exists.
    if (unsafe && req.headers.origin !== undefined && req.headers.origin !== config.allowedOrigin) {
      throw originError();
    }

    const token = readCookie(req, config.cookieName);
    const session = token ? await sessions.resolve(token) : null;
    if (!session) {
      if (token) res.clearCookie(config.cookieName, sessionCookieOptions(config));
      throw unauthorized();
    }

    const user = await repo.findUserById(session.userId);
    const roles = user ? toRoles(user.roles) : [];
    if (!user || !user.isActive || user.employeeStatus !== 'active' || roles.length === 0) {
      await sessions.revokeAllForUser(session.userId);
      res.clearCookie(config.cookieName, sessionCookieOptions(config));
      throw unauthorized();
    }

    if (unsafe && !sameToken(session.csrfToken, req.headers['x-csrf-token'])) {
      throw csrfError();
    }

    req.actor = { id: user.id, employeeId: user.employeeId, role: roles[0] as Role, roles };
    req.session = { tokenHash: session.tokenHash, csrfToken: session.csrfToken };
  };

  return (req, res, next) => {
    authenticate(req, res).then(() => next(), next);
  };
}
