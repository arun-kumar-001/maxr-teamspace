import { PaginatedResponse, PaginationInput } from '@maxr/shared';
import { validationError } from './errors';

export interface PageRequest {
  page: number;
  pageSize: number;
}

/** SQL `OFFSET` / `LIMIT` for a validated page request. */
export function toOffsetLimit({ page, pageSize }: PageRequest): { offset: number; limit: number } {
  return { offset: (page - 1) * pageSize, limit: pageSize };
}

/** Builds the standard `{ data, meta }` list response. */
export function buildPage<T>(
  items: T[],
  total: number,
  { page, pageSize }: PageRequest,
): PaginatedResponse<T> {
  return {
    data: items,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export interface SortSpec {
  column: string;
  order: 'asc' | 'desc';
}

/**
 * Maps the client's `sortBy` to a SQL column through an allow-list, so a client can never
 * inject an identifier into ORDER BY. Unknown fields are rejected with 400.
 *
 * @param allowed API field name -> SQL column (e.g. `{ name: 'e.full_name' }`)
 */
export function resolveSort(
  query: Pick<PaginationInput, 'sortBy' | 'sortOrder'>,
  allowed: Readonly<Record<string, string>>,
  fallback: SortSpec,
): SortSpec {
  if (!query.sortBy) {
    return fallback;
  }
  const column = Object.prototype.hasOwnProperty.call(allowed, query.sortBy)
    ? allowed[query.sortBy]
    : undefined;
  if (!column) {
    throw validationError([
      {
        field: 'query.sortBy',
        message: `Sorting by '${query.sortBy}' is not supported. Allowed: ${Object.keys(allowed).join(', ')}`,
        rule: 'invalid_enum_value',
      },
    ]);
  }
  return { column, order: query.sortOrder };
}
