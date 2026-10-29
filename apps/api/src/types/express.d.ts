import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the request-id middleware. */
    id?: string;
    /** Parsed and validated params/query/body, set by `validate()`. */
    validated?: { params?: unknown; query?: unknown; body?: unknown };
    /** The authenticated user. Populated by the auth middleware (issue #7). */
    actor?: { id: string };
  }
}
