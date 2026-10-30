import 'express-serve-static-core';
import type { Role } from '@maxr/shared';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the request-id middleware. */
    id?: string;
    /** Parsed and validated params/query/body, set by `validate()`. */
    validated?: { params?: unknown; query?: unknown; body?: unknown };
    /** The authenticated user, set by the `authenticate` middleware (modules/auth). */
    actor?: {
      id: string;
      employeeId: string;
      /** Highest-privilege role. */
      role: Role;
      roles: Role[];
    };
    /** The decision of `requirePermission` for this request (permission, scope, repository filter). */
    access?: import('../modules/rbac/require-permission').AccessDecision;
    /** The live session behind `actor`. */
    session?: { tokenHash: string; csrfToken: string };
  }
}
