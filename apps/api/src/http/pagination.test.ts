import { MAX_PAGE_SIZE, paginationQuerySchema } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from './app-error';
import { buildPage, resolveSort, toOffsetLimit } from './pagination';

describe('pagination query (TC-9-07)', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sortOrder: 'asc',
    });
  });
  it('coerces numeric strings (query strings are strings)', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
  });
  it.each([
    [{ page: '0' }],
    [{ page: '-1' }],
    [{ page: '1.5' }],
    [{ pageSize: '0' }],
    [{ pageSize: String(MAX_PAGE_SIZE + 1) }],
    [{ sortOrder: 'sideways' }],
    [{ sortBy: 'name; DROP TABLE x' }],
    [{ search: '' }],
  ])('rejects %j (never silently clamps)', (input) => {
    expect(paginationQuerySchema.safeParse(input).success).toBe(false);
  });
  it('accepts the maximum page size', () => {
    expect(paginationQuerySchema.parse({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(100);
  });
});

describe('pagination math (TC-9-08)', () => {
  it('computes offset and limit', () => {
    expect(toOffsetLimit({ page: 1, pageSize: 20 })).toEqual({ offset: 0, limit: 20 });
    expect(toOffsetLimit({ page: 3, pageSize: 20 })).toEqual({ offset: 40, limit: 20 });
  });
  it('builds meta for a normal page, the last page and an empty result', () => {
    expect(buildPage([1, 2], 45, { page: 1, pageSize: 20 }).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    expect(buildPage([1], 41, { page: 3, pageSize: 20 }).meta.totalPages).toBe(3);
    expect(buildPage([], 0, { page: 1, pageSize: 20 }).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    expect(buildPage([1, 2, 3], 3, { page: 1, pageSize: 3 }).meta.totalPages).toBe(1);
  });
});

describe('sorting allow-list', () => {
  const allowed = { name: 'e.full_name', joined: 'e.joining_date' } as const;
  const fallback = { column: 'e.created_at', order: 'desc' as const };

  it('uses the fallback when no sortBy is given', () => {
    expect(resolveSort({ sortOrder: 'asc' }, allowed, fallback)).toEqual(fallback);
  });
  it('maps an allowed API field to its SQL column', () => {
    expect(resolveSort({ sortBy: 'joined', sortOrder: 'desc' }, allowed, fallback)).toEqual({
      column: 'e.joining_date',
      order: 'desc',
    });
  });
  it('rejects fields that are not allowed, including prototype keys', () => {
    for (const bad of ['password', 'constructor', '__proto__', 'toString']) {
      expect(() => resolveSort({ sortBy: bad, sortOrder: 'asc' }, allowed, fallback)).toThrow(
        AppError,
      );
    }
    try {
      resolveSort({ sortBy: 'password', sortOrder: 'asc' }, allowed, fallback);
    } catch (e) {
      expect((e as AppError).statusCode).toBe(400);
      expect((e as AppError).code).toBe('VALIDATION_ERROR');
    }
  });
});
