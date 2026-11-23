import { MIN_PASSWORD_LENGTH } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { createEmployeeSchema } from '../employees/creation/creation.schemas';
import { setPasswordSchema } from '../employees/onboarding/onboarding.schemas';
import { createUserSchema } from '../users/users.schemas';
import { loadAuthConfig } from './auth-config';

const ID = '11111111-1111-4111-8111-111111111111';
const employee = (password: string) =>
  createEmployeeSchema.safeParse({
    employeeCode: 'EMP-900',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.test',
    departmentId: ID,
    designationId: ID,
    joiningDate: '2026-11-01',
    role: 'staff',
    password,
  });
const user = (password: string) =>
  createUserSchema.safeParse({
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.test',
    roles: ['staff'],
    password,
  });

/** Every way of setting a password enforces the same minimum, so none is a weaker way in. */
describe('one password minimum everywhere', () => {
  const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
  const ok = 'a'.repeat(MIN_PASSWORD_LENGTH);

  it('is 12 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it.each([
    ['employee creation', employee],
    ['user creation', user],
    [
      'onboarding set-password',
      (p: string) => setPasswordSchema.safeParse({ token: 't'.repeat(20), newPassword: p }),
    ],
  ])('%s rejects one character too few and accepts the minimum', (_name, parse) => {
    expect(parse(short).success).toBe(false);
    expect(parse(ok).success).toBe(true);
  });

  it('the sign-in service uses the same minimum for changing a password', () => {
    expect(loadAuthConfig({}, 'development', 'http://localhost:3000').minPasswordLength).toBe(
      MIN_PASSWORD_LENGTH,
    );
  });
});
