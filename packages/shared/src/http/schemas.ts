import { z } from 'zod';

/**
 * Shared request-validation primitives (AGENTS.md §5).
 * Backend validates with them; the web app may reuse them for client-side checks.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** `:id` path parameter. Rejects anything that is not a UUID before it reaches SQL. */
export const idParamSchema = z.object({ id: z.string().uuid() }).strict();

/** Common list-endpoint query. Out-of-range values are rejected, never silently clamped. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sortBy: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().trim().min(1).max(100).optional(),
});

export type PaginationInput = z.infer<typeof paginationQuerySchema>;

/**
 * Builds a strict list-query schema: pagination plus module-specific filters.
 * Unknown query keys are rejected so typos do not silently disable a filter.
 */
export function listQuerySchema<T extends z.ZodRawShape>(filters: T) {
  return paginationQuerySchema.extend(filters).strict();
}

/** `?isActive=true|false` (query strings are always strings). */
export const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
