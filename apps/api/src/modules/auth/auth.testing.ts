import { ROLES, type Role } from '@maxr/shared';
import { RequestHandler } from 'express';
import type { AuditLogger } from '../../platform';
import { AuthConfig } from './auth-config';
import { InMemoryAuthRepository } from './auth.repository.memory';
import { AuthUser } from './auth.types';
import { AuthServices, createAuth } from './index';
import { PasswordHasher, createArgon2Hasher } from './password-hasher';
import { InMemorySessionStore } from './session-store';

/** Cheap Argon2id settings so tests that hash stay fast; production uses the ADR parameters. */
export const testHasher: PasswordHasher = createArgon2Hasher({
  memoryCost: 1024,
  timeCost: 1,
  parallelism: 1,
});

export const TEST_PASSWORD = 'Correct-horse-9-battery';

export const testAuthConfig = (overrides: Partial<AuthConfig> = {}): AuthConfig => ({
  cookieName: 'maxr_session',
  cookieSecure: false,
  sessionMaxAgeMs: 8 * 3_600_000,
  sessionIdleMs: 30 * 60_000,
  maxLoginFailures: 5,
  lockoutWindowMs: 15 * 60_000,
  allowedOrigin: 'http://localhost:3000',
  minPasswordLength: 12,
  maxPasswordLength: 128,
  ...overrides,
});

export interface TestAuthKit {
  auth: AuthServices;
  repo: InMemoryAuthRepository;
  store: InMemorySessionStore;
  config: AuthConfig;
  /** One user per role, all with TEST_PASSWORD. */
  users: Record<Role, AuthUser>;
  clock: { now: Date; advance(ms: number): void };
}

const passthrough: RequestHandler = (_req, _res, next) => next();

let sharedHash: Promise<string> | null = null;
const hashOfTestPassword = (): Promise<string> => (sharedHash ??= testHasher.hash(TEST_PASSWORD));

/** In-memory auth for HTTP tests: no PostgreSQL, no Redis, a movable clock, four seeded users. */
export function createTestAuth(
  audit: AuditLogger,
  overrides: { config?: Partial<AuthConfig>; loginRateLimiter?: RequestHandler } = {},
): TestAuthKit {
  const clock = {
    now: new Date('2026-10-29T09:00:00Z'),
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    },
  };
  const config = testAuthConfig(overrides.config);
  const users = {} as Record<Role, AuthUser>;
  const ready = hashOfTestPassword().then((hash) => {
    for (const user of Object.values(users)) user.passwordHash = hash;
  });
  const repo = new InMemoryAuthRepository(() => clock.now, ready);
  const store = new InMemorySessionStore(() => clock.now.getTime());
  Object.values(ROLES).forEach((role, index) => {
    const user: AuthUser = {
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      employeeId: `00000000-0000-4000-9000-00000000000${index + 1}`,
      email: `${role}@maxr.test`,
      passwordHash: '',
      isActive: true,
      employeeStatus: 'active',
      firstName: role,
      lastName: 'Tester',
      roles: [role],
    };
    users[role] = user;
    repo.users.set(user.id, user);
  });
  repo.permissionsByRole = {
    admin: ['employee.read', 'employee.create'],
    staff: ['employee.read_own'],
  };

  const auth = createAuth({
    config,
    audit,
    repo,
    store,
    hasher: testHasher,
    loginRateLimiter: overrides.loginRateLimiter ?? passthrough,
    now: () => clock.now,
  });
  return { auth, repo, store, config, users, clock };
}
