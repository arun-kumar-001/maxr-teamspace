import { ApiErrorDetail } from '@maxr/shared';
import { RequestHandler } from 'express';
import { ZodError, ZodTypeAny, z } from 'zod';
import { validationError } from './errors';

export interface RequestSchemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

const MAX_DETAILS = 20;
const MAX_MESSAGE_LENGTH = 200;

function toDetails(location: string, error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: [location, ...issue.path].join('.'),
    message: issue.message.slice(0, MAX_MESSAGE_LENGTH),
    rule: issue.code,
  }));
}

/**
 * Validates params, query and body at the HTTP boundary. On success the parsed values
 * (with defaults applied and types coerced) are on `req.validated`; unvalidated input
 * must never be read by controllers. On failure responds 400 VALIDATION_ERROR.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: ApiErrorDetail[] = [];
    const validated: NonNullable<typeof req.validated> = {};

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) {
        continue;
      }
      const result = schema.safeParse(req[location]);
      if (result.success) {
        validated[location] = result.data;
      } else {
        details.push(...toDetails(location, result.error));
      }
    }

    if (details.length > 0) {
      next(validationError(details.slice(0, MAX_DETAILS)));
      return;
    }
    req.validated = validated;
    next();
  };
}

/** Typed accessor for what `validate()` produced. */
export function validated<S extends RequestSchemas>(
  req: { validated?: unknown },
  _schemas?: S,
): {
  params: S['params'] extends ZodTypeAny ? z.infer<S['params']> : undefined;
  query: S['query'] extends ZodTypeAny ? z.infer<S['query']> : undefined;
  body: S['body'] extends ZodTypeAny ? z.infer<S['body']> : undefined;
} {
  return (req.validated ?? {}) as never;
}
