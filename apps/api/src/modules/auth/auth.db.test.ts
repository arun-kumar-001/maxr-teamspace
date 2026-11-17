import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { closeRedis, getRedisClient } from '../../db/redis';
import { createApp } from '../../app';
import { createTestPlatform } from '../../platform';
import { generousHttp, healthyDeps } from '../../test/helpers';
import { loadAuthConfig } from './auth-config';
import { PgAuthRepository } from './auth.repository';
import { createAuth } from './index';

const pool = getPool();
const repo = new PgAuthRepository(() => pool);
const ORIGIN = 'http://localhost:3000';
const DEV_PASSWORD = 'Password123!';
const TEST_DOMAIN = `auth-${Date.now()}@maxr.test`;
const SEEDED = [
  ['admin@maxr.internal', 'admin'],
  [`hr-${TEST_DOMAIN}`, 'hr_manager'],
  [`lead-${TEST_DOMAIN}`, 'team_lead'],
  [`staff-${TEST_DOMAIN}`, 'staff'],
] as const;

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@maxr.test`;

beforeAll(async () => {
  const admin = await repo.findUserByEmail('admin@maxr.internal');
  for (const [email, role] of SEEDED.slice(1)) {
    const employee = await pool.query<{ id: string }>(
      "INSERT INTO employees (employee_code, first_name, last_name, email, status, department_id, designation_id) SELECT $1, 'Auth', 'Fixture', $2, 'active', department_id, designation_id FROM employees WHERE email = 'admin@maxr.internal' RETURNING id",
      [`AUTH-${role}-${Date.now()}`, email],
    );
    const user = await pool.query<{ id: string }>(
      'INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, $3, true) RETURNING id',
      [employee.rows[0]!.id, email, admin!.passwordHash],
    );
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2',
      [user.rows[0]!.id, role],
    );
  }
});

afterAll(async () => {
  for (const [email] of SEEDED.slice(1)) {
    await pool.query(
      'DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
      [email],
    );
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await pool.query('DELETE FROM employees WHERE email = $1', [email]);
    await pool.query('DELETE FROM login_attempts WHERE identifier = $1', [email]);
  }
  await pool.query("DELETE FROM login_attempts WHERE identifier LIKE 'test-%@maxr.test'");
  await closeRedis();
  await closePool();
});

describe('PgAuthRepository (real PostgreSQL, seeded development users)', () => {
  it('finds a user by email, case-insensitively, with the employee status and role', async () => {
    const user = await repo.findUserByEmail('ADMIN@maxr.internal');
    expect(user).toMatchObject({
      email: 'admin@maxr.internal',
      isActive: true,
      employeeStatus: 'active',
      roles: ['admin'],
    });
    expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await repo.findUserById(user?.id ?? '')).toMatchObject({ email: 'admin@maxr.internal' });
    expect(await repo.findUserByEmail('nobody@maxr.internal')).toBeNull();
  });

  it('counts recent failures per identifier and resets them after a success', async () => {
    const id = unique();
    const since = new Date(Date.now() - 60_000);
    expect(await repo.recentFailures(id, since)).toEqual({ count: 0, oldestAt: null });

    await repo.recordLoginAttempt({ identifier: id, ip: '10.0.0.1', success: false });
    await repo.recordLoginAttempt({ identifier: id, ip: '10.0.0.2', success: false });
    const two = await repo.recentFailures(id, since);
    expect(two.count).toBe(2);
    expect(two.oldestAt).toBeInstanceOf(Date);

    await repo.recordLoginAttempt({ identifier: id, ip: '10.0.0.1', success: true });
    expect((await repo.recentFailures(id, since)).count).toBe(0);
    await repo.recordLoginAttempt({ identifier: id, ip: '10.0.0.1', success: false });
    expect((await repo.recentFailures(id, since)).count).toBe(1);

    const farFuture = new Date(Date.now() + 60_000);
    expect((await repo.recentFailures(id, farFuture)).count).toBe(0); // outside the window
    expect((await repo.recentFailures(unique(), since)).count).toBe(0); // other identifier
  });

  it('truncates an over-long identifier or address instead of failing', async () => {
    await expect(
      repo.recordLoginAttempt({
        identifier: `test-${'x'.repeat(400)}@maxr.test`,
        ip: 'f'.repeat(80),
        success: false,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('full sign-in against PostgreSQL and Redis with the seeded development users', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const test = createTestPlatform();
    const audit = test.platform.audit.withContext({});
    const config = loadAuthConfig({}, 'test', ORIGIN);
    const auth = createAuth({
      config,
      audit,
      loginRateLimiter: (_req, _res, next) => next(),
      getPool: () => pool,
      getRedis: getRedisClient,
    });
    app = createApp({
      http: generousHttp,
      nodeEnv: 'test',
      health: healthyDeps,
      platform: test.platform,
      auth,
    });
  });

  it.each(SEEDED)(
    '%s can sign in with the development password and gets the %s role',
    async (email, role) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .send({ email, password: DEV_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({ email, role });

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]?.split(';')[0] ?? '';
      const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);

      const out = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', res.body.data.csrfToken);
      expect(out.status).toBe(204);
      expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    },
  );

  it('rejects a wrong password and records the failed attempt', async () => {
    const before = await pool.query(
      "SELECT count(*)::int AS n FROM login_attempts WHERE identifier = 'staff@maxr.internal'",
    );
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'staff@maxr.internal', password: 'definitely-not-it-1' });
    expect(res.status).toBe(401);
    const after = await pool.query(
      "SELECT count(*)::int AS n FROM login_attempts WHERE identifier = 'staff@maxr.internal'",
    );
    expect(after.rows[0].n).toBe(before.rows[0].n + 1);
    // Leave no failure behind that could lock the shared development account.
    await pool.query(
      "DELETE FROM login_attempts WHERE identifier = 'staff@maxr.internal' AND success = false",
    );
  });

  it('a user who is deactivated in the database loses access on the next request', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: SEEDED[1][0], password: DEV_PASSWORD });
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0]?.split(';')[0] ?? '';
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);

    await pool.query('UPDATE users SET is_active = false WHERE email = $1', [SEEDED[1][0]]);
    try {
      expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    } finally {
      await pool.query('UPDATE users SET is_active = true WHERE email = $1', [SEEDED[1][0]]);
    }
  });
});
