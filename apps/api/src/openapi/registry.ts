import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { ZodObject, ZodRawShape, ZodTypeAny, z } from 'zod';

// Schemas are named and described with Zod 4's native `.meta({ id, example, ... })`.
// Do not use `extendZodWithOpenApi`: it patches schemas only if it runs before they are
// created, which makes the result depend on import order.
export const registry = new OpenAPIRegistry();

const detailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  rule: z.string().optional(),
});

/** The standard error envelope (AGENTS.md §5), referenced by every error response. */
export const errorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.array(detailSchema).optional(),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'ErrorEnvelope' });

type Method = 'get' | 'post' | 'put' | 'delete';

export interface RouteDoc {
  method: Method;
  /** OpenAPI style path relative to /api/v1, e.g. `/templates/{id}`. */
  path: string;
  tags: string[];
  summary: string;
  /** Permission required once RBAC lands (issue #8), shown in the description. */
  permission?: string;
  params?: ZodObject<ZodRawShape>;
  query?: ZodObject<ZodRawShape>;
  body?: ZodTypeAny;
  /** Adds the required Idempotency-Key header. */
  idempotent?: boolean;
  success: { status: number; description: string; schema?: ZodTypeAny };
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorEnvelopeSchema } },
});

/** Registers one route and attaches the standard error responses automatically. */
export function registerRoute(doc: RouteDoc): void {
  const isWrite = doc.method !== 'get';
  const headers = doc.idempotent
    ? z.object({
        'Idempotency-Key': z
          .string()
          .min(8)
          .max(128)
          .meta({ example: 'b7d1c0e2-3f4a-4c55-9a77-1d2e3f4a5b6c' }),
      })
    : undefined;

  registry.registerPath({
    method: doc.method,
    path: doc.path,
    tags: doc.tags,
    summary: doc.summary,
    description: doc.permission ? `Required permission: \`${doc.permission}\`` : undefined,
    request: {
      params: doc.params,
      query: doc.query,
      headers,
      body: doc.body
        ? { required: true, content: { 'application/json': { schema: doc.body } } }
        : undefined,
    },
    responses: {
      [doc.success.status]: {
        description: doc.success.description,
        ...(doc.success.schema
          ? { content: { 'application/json': { schema: doc.success.schema } } }
          : {}),
      },
      400: errorResponse('Validation failed or malformed request'),
      401: errorResponse('Authentication required'),
      403: errorResponse('Not permitted'),
      ...(doc.params ? { 404: errorResponse('Not found (or outside your scope)') } : {}),
      ...(isWrite
        ? {
            409: errorResponse('Conflict or duplicate'),
            422: errorResponse('Business rule violated'),
          }
        : {}),
      429: errorResponse('Rate limit exceeded'),
      500: errorResponse('Unexpected server error'),
    },
  });
}

export function generateDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'MAXR Teamspace API',
      version: '0.1.0',
      description:
        'Generated from the Zod schemas used for request validation, so it cannot drift from the code.',
    },
    servers: [{ url: '/api/v1' }],
  });
}
