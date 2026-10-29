import { describe, expect, it } from 'vitest';
import { mapDatabaseError } from './db-errors';

describe('database error mapping (TC-9-13)', () => {
  it.each([
    ['23505', 409, 'CONFLICT'],
    ['23503', 422, 'UNPROCESSABLE_ENTITY'],
    ['23502', 422, 'UNPROCESSABLE_ENTITY'],
    ['23514', 422, 'UNPROCESSABLE_ENTITY'],
    ['22P02', 400, 'BAD_REQUEST'],
  ])('maps PostgreSQL %s to %i %s', (code, status, apiCode) => {
    const mapped = mapDatabaseError(
      Object.assign(new Error('raw SQL text with "users_email_key"'), { code }),
    );
    expect(mapped?.statusCode).toBe(status);
    expect(mapped?.code).toBe(apiCode);
  });

  it('never leaks SQL text, constraint names or values', () => {
    const mapped = mapDatabaseError(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "users_email_key" Key (email)=(a@b.com)',
        ),
        { code: '23505' },
      ),
    );
    expect(mapped?.message).not.toMatch(/users_email_key|a@b\.com|duplicate key/);
  });

  it('returns null for unknown codes and non-database errors', () => {
    expect(mapDatabaseError(Object.assign(new Error('x'), { code: '99999' }))).toBeNull();
    expect(mapDatabaseError(new Error('plain'))).toBeNull();
    expect(mapDatabaseError('string')).toBeNull();
    expect(mapDatabaseError(null)).toBeNull();
    expect(mapDatabaseError({ code: 23505 })).toBeNull();
  });
});
