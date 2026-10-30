import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../platform';
import { makeApp } from '../../test/helpers';
import { TEST_PASSWORD, createTestAuth, testAuthConfig, testHasher } from './auth.testing';

const ORIGIN = 'http://localhost:3000';

const cookieOf = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('maxr_session=')) ?? '';
};
/** `name=value` part of a Set-Cookie header, to send back. */
const cookieValue = (setCookie: string): string => setCookie.split(';')[0] ?? '';

async function signIn(
  app: Parameters<typeof request>[0],
  email = 'staff@maxr.test',
  password = TEST_PASSWORD,
) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password });
  return { res, cookie: cookieValue(cookieOf(res)), csrf: res.body?.data?.csrfToken as string };
}

describe('POST /auth/login', () => {
  it('signs in, sets a hardened session cookie and returns the profile and CSRF token', async () => {
    const { app } = makeApp();
    const { res } = await signIn(app, 'admin@maxr.test');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      email: 'admin@maxr.test',
      role: 'admin',
      roles: ['admin'],
    });
    expect(res.body.data.user.permissions).toEqual(['employee.create', 'employee.read']);
    expect(res.body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const cookie = cookieOf(res);
    expect(cookie).toMatch(/^maxr_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api');
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('marks the cookie Secure when configured for production', async () => {
    const { app } = makeApp({
      auth: createTestAuth(makeApp().platform.audit, { config: { cookieSecure: true } }),
    });
    const { res } = await signIn(app);
    expect(cookieOf(res)).toContain('Secure');
  });

  it('never returns the password hash or the session token in the body', async () => {
    const { app } = makeApp();
    const { res } = await signIn(app);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/argon2|passwordHash|password_hash/i);
    expect(text).not.toContain(cookieOf(res).split(';')[0]?.split('=')[1] ?? 'x-none');
  });

  it('is case-insensitive for the email and trims it', async () => {
    const { app } = makeApp();
    const { res } = await signIn(app, '  STAFF@MAXR.TEST ');
    expect(res.status).toBe(200);
  });

  it('answers identically for an unknown email and a wrong password (no account enumeration)', async () => {
    const { app } = makeApp();
    const unknown = await signIn(app, 'nobody@maxr.test', 'whatever-password-1');
    const wrong = await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    expect(unknown.res.status).toBe(401);
    expect(wrong.res.status).toBe(401);
    const strip = (b: { error: { requestId?: string } }) => ({ ...b.error, requestId: undefined });
    expect(strip(unknown.res.body)).toEqual(strip(wrong.res.body));
    expect(unknown.res.body.error.message).toBe('Invalid email or password');
    expect(cookieOf(unknown.res)).toBe('');
  });

  it('verifies against a dummy hash when the account does not exist, so timing does not reveal it', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const verify = vi.spyOn(testHasher, 'verify');
    await signIn(app, 'nobody@maxr.test', 'whatever-password-1');
    expect(verify).toHaveBeenCalledTimes(1);
    const checkedHash = verify.mock.calls[0]?.[0] ?? '';
    expect(checkedHash.startsWith('$argon2id$')).toBe(true);
    expect(checkedHash).not.toBe(kit.users.staff.passwordHash); // a dummy, not a real account's hash

    verify.mockClear();
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0]?.[0]).toBe(kit.users.staff.passwordHash);
    verify.mockRestore();
  });

  it.each([
    ['an inactive account', { isActive: false }],
    ['an employee who is not active yet (onboarding)', { employeeStatus: 'pending' }],
    ['a deactivated employee', { employeeStatus: 'deactivated' }],
    ['an account with no role', { roles: [] as string[] }],
  ])(
    'rejects %s even with the right password, with the same generic answer',
    async (_name, change) => {
      const kit = createTestAuth(makeApp().platform.audit);
      const { app } = makeApp({ auth: kit });
      Object.assign(kit.users.staff, change);
      const { res } = await signIn(app);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
      expect(cookieOf(res)).toBe('');
    },
  );

  it('validates the body: missing fields, wrong types, unknown keys and huge passwords', async () => {
    const { app } = makeApp();
    const post = (body: unknown) =>
      request(app)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .send(body as object);
    expect((await post({})).status).toBe(400);
    expect((await post({ email: 'a@b.co' })).status).toBe(400);
    expect((await post({ email: 5, password: 'x' })).status).toBe(400);
    expect((await post({ email: 'staff@maxr.test', password: 'x', role: 'admin' })).status).toBe(
      400,
    );
    expect((await post({ email: 'staff@maxr.test', password: 'x'.repeat(129) })).status).toBe(400);
  });

  it('refuses a login from another origin', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'staff@maxr.test', password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(cookieOf(res)).toBe('');
  });

  it('is limited per IP by the login rate limiter', async () => {
    const { createRateLimiter } = await import('../../http/rate-limit');
    const audit = makeApp().platform.audit;
    const kit = createTestAuth(audit, {
      loginRateLimiter: createRateLimiter({ windowMs: 60_000, max: 2 }),
    });
    const { app } = makeApp({ auth: kit });
    expect((await signIn(app)).res.status).toBe(200);
    expect((await signIn(app)).res.status).toBe(200);
    const third = await signIn(app);
    expect(third.res.status).toBe(429);
    expect(third.res.headers['retry-after']).toBeDefined();
  });
});

describe('login lockout', () => {
  it('locks an account after the allowed failures, even for the right password, then recovers', async () => {
    const kit = createTestAuth(makeApp().platform.audit, { config: { maxLoginFailures: 3 } });
    const { app } = makeApp({ auth: kit });
    for (let i = 0; i < 3; i++) {
      expect((await signIn(app, 'staff@maxr.test', 'wrong-password-123')).res.status).toBe(401);
    }
    const locked = await signIn(app, 'staff@maxr.test', TEST_PASSWORD);
    expect(locked.res.status).toBe(429);
    expect(Number(locked.res.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(locked.res.headers['retry-after'])).toBeLessThanOrEqual(900);
    expect(cookieOf(locked.res)).toBe('');

    kit.clock.advance(15 * 60_000 + 1000);
    expect((await signIn(app, 'staff@maxr.test', TEST_PASSWORD)).res.status).toBe(200);
  });

  it('counts unknown emails too, so lockout does not reveal which accounts exist', async () => {
    const kit = createTestAuth(makeApp().platform.audit, { config: { maxLoginFailures: 2 } });
    const { app } = makeApp({ auth: kit });
    await signIn(app, 'ghost@maxr.test', 'whatever-password-1');
    await signIn(app, 'ghost@maxr.test', 'whatever-password-1');
    expect((await signIn(app, 'ghost@maxr.test', 'whatever-password-1')).res.status).toBe(429);
  });

  it('a successful sign-in resets the failure count', async () => {
    const kit = createTestAuth(makeApp().platform.audit, { config: { maxLoginFailures: 3 } });
    const { app } = makeApp({ auth: kit });
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    expect((await signIn(app)).res.status).toBe(200);
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    expect((await signIn(app)).res.status).toBe(200);
  });

  it('one account locking does not affect another', async () => {
    const kit = createTestAuth(makeApp().platform.audit, { config: { maxLoginFailures: 1 } });
    const { app } = makeApp({ auth: kit });
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    expect((await signIn(app, 'staff@maxr.test')).res.status).toBe(429);
    expect((await signIn(app, 'admin@maxr.test')).res.status).toBe(200);
  });
});

describe('sessions: GET /auth/me and authenticate', () => {
  it('rejects requests with no cookie, a forged cookie and a malformed cookie', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', `maxr_session=${'a'.repeat(43)}`)
      ).status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', 'maxr_session=garbage')).status,
    ).toBe(401);
  });

  it('returns the current user for a valid session', async () => {
    const { app } = makeApp();
    const { cookie } = await signIn(app, 'hr_manager@maxr.test');
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ role: 'hr_manager' });
  });

  it('ends after the idle time and after the absolute limit', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const { cookie } = await signIn(app);
    kit.clock.advance(20 * 60_000);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
    kit.clock.advance(31 * 60_000);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);

    const second = await signIn(app);
    for (let i = 0; i < 16; i++) {
      kit.clock.advance(29 * 60_000);
      await request(app).get('/api/v1/auth/me').set('Cookie', second.cookie);
    }
    kit.clock.advance(29 * 60_000);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', second.cookie)).status).toBe(
      401,
    );
  });

  it('rejects a deactivated user immediately, even with a live session', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const { cookie } = await signIn(app);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
    kit.users.staff.isActive = false;
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(cookieOf(res)).toContain('Expires=Thu, 01 Jan 1970'); // cookie cleared
    kit.users.staff.isActive = true;
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401); // sessions were ended
  });

  it('picks up a role change on the next request', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const { cookie } = await signIn(app);
    kit.users.staff.roles = ['team_lead'];
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.body.data.user.role).toBe('team_lead');
  });

  it('SessionService.revokeAllForUser (used on deactivation) ends all sessions', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const a = await signIn(app);
    const b = await signIn(app);
    expect(await kit.auth.sessions.revokeAllForUser(kit.users.staff.id)).toBe(2);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', a.cookie)).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', b.cookie)).status).toBe(401);
  });

  it('sets the acting user on the request for protected routes', async () => {
    const kit = createTestAuth(makeApp().platform.audit);
    const { app } = makeApp({ auth: kit });
    const { cookie } = await signIn(app, 'team_lead@maxr.test');
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.body.data.user.id).toBe(kit.users.team_lead.id);
    expect(res.body.data.user.employeeId).toBe(kit.users.team_lead.employeeId);
  });
});

describe('CSRF and origin protection', () => {
  it('requires the CSRF token on state-changing requests', async () => {
    const { app } = makeApp();
    const { cookie, csrf } = await signIn(app);
    const withoutToken = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN);
    expect(withoutToken.status).toBe(403);
    const wrongToken = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', 'x'.repeat(43));
    expect(wrongToken.status).toBe(403);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200); // still signed in
    const ok = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf);
    expect(ok.status).toBe(204);
  });

  it('rejects a state-changing request from another origin before looking at the session', async () => {
    const { app } = makeApp();
    const { cookie, csrf } = await signIn(app);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
  });

  it('a CSRF token of one session does not work for another', async () => {
    const { app } = makeApp();
    const a = await signIn(app);
    const b = await signIn(app, 'admin@maxr.test');
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', b.csrf);
    expect(res.status).toBe(403);
  });
});

describe('POST /auth/logout', () => {
  it('ends the session, clears the cookie and is audited', async () => {
    const { app, auditStore } = makeApp();
    const { cookie, csrf } = await signIn(app);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(204);
    expect(cookieOf(res)).toContain('Expires=Thu, 01 Jan 1970');
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect(auditStore.list().map((e) => e.action)).toContain('auth.logout');
  });

  it('only ends its own session', async () => {
    const { app } = makeApp();
    const a = await signIn(app);
    const b = await signIn(app);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', b.cookie)).status).toBe(200);
  });
});

describe('POST /auth/change-password', () => {
  const NEW_PASSWORD = 'A-brand-new-passphrase-42';
  const change = (
    app: Parameters<typeof request>[0],
    s: { cookie: string; csrf: string },
    body: object,
  ) =>
    request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', s.cookie)
      .set('X-CSRF-Token', s.csrf)
      .send(body);

  it('changes the password, ends the user’s other sessions and keeps the current one', async () => {
    const { app } = makeApp();
    const current = await signIn(app);
    const other = await signIn(app);
    const res = await change(app, current, {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(204);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', current.cookie)).status).toBe(
      200,
    );
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', other.cookie)).status).toBe(
      401,
    );
    expect((await signIn(app, 'staff@maxr.test', TEST_PASSWORD)).res.status).toBe(401);
    expect((await signIn(app, 'staff@maxr.test', NEW_PASSWORD)).res.status).toBe(200);
  });

  it('requires the right current password, and says so without changing anything', async () => {
    const { app } = makeApp();
    const s = await signIn(app);
    const res = await change(app, s, {
      currentPassword: 'not-my-password-1',
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(403);
    expect((await signIn(app)).res.status).toBe(200);
  });

  it.each([
    ['too short', 'Short-1'],
    ['too long', `${'a'.repeat(129)}`],
    ['the same as the current one', TEST_PASSWORD],
    ['a well-known weak password', 'Password123!'],
    ['the email address', 'staff@maxr.test'],
  ])('rejects a new password that is %s', async (_name, newPassword) => {
    const { app } = makeApp();
    const s = await signIn(app);
    const res = await change(app, s, { currentPassword: TEST_PASSWORD, newPassword });
    expect([400, 422]).toContain(res.status);
    expect((await signIn(app)).res.status).toBe(200); // unchanged
  });

  it('needs a session and the CSRF token', async () => {
    const { app } = makeApp();
    expect(
      (
        await request(app)
          .post('/api/v1/auth/change-password')
          .send({ currentPassword: 'x', newPassword: 'y' })
      ).status,
    ).toBe(401);
    const s = await signIn(app);
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', s.cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('audit trail and logs', () => {
  it('records sign-ins and failures with the reason but never the password or token', async () => {
    const { app, auditStore, lines } = makeApp();
    const { res } = await signIn(app);
    await signIn(app, 'staff@maxr.test', 'wrong-password-123');
    await signIn(app, 'nobody@maxr.test', 'another-wrong-pass-9');

    const actions = auditStore.list().map((e) => `${e.action}:${e.outcome}`);
    expect(actions).toEqual([
      'auth.login:success',
      'auth.login_failed:failure',
      'auth.login_failed:failure',
    ]);
    expect(auditStore.list()[1]?.metadata).toMatchObject({ reason: 'bad_password' });
    expect(auditStore.list()[2]?.metadata).toMatchObject({ reason: 'unknown_user' });

    const everything = JSON.stringify(auditStore.list()) + lines.join('\n');
    for (const secret of [
      TEST_PASSWORD,
      'wrong-password-123',
      'another-wrong-pass-9',
      res.body.data.csrfToken,
    ]) {
      expect(everything).not.toContain(secret);
    }
    expect(everything).not.toContain(cookieOf(res).split(';')[0]?.split('=')[1] ?? 'x-none');
  });

  it('does not sign in if the audit entry cannot be written (fails closed)', async () => {
    const failingAudit: AuditLogger = {
      record: async () => {
        throw new Error('audit store down');
      },
      tryRecord: async () => null,
      withContext: () => failingAudit,
    };
    const { app } = makeApp({ auth: createTestAuth(failingAudit) });
    const { res, cookie } = await signIn(app);
    expect(res.status).toBe(500);
    expect(cookieOf(res)).toBe('');
    expect(cookie).toBe('');
  });

  it('removes the session it just created when the audit entry fails', async () => {
    let failNext = false;
    const { platform } = makeApp();
    const audit: AuditLogger = {
      record: async (event) => {
        if (failNext && event.action === 'auth.login') throw new Error('audit store down');
        return platform.audit.record(event);
      },
      tryRecord: (event) => platform.audit.tryRecord(event),
      withContext: () => audit,
    };
    const kit = createTestAuth(audit);
    const { app } = makeApp({ auth: kit, platform });
    failNext = true;
    expect((await signIn(app)).res.status).toBe(500);
    failNext = false;
    expect(await kit.auth.sessions.revokeAllForUser(kit.users.staff.id)).toBe(0); // nothing was left behind
  });
});

describe('configuration', () => {
  it('refuses an insecure cookie in production', async () => {
    const { loadAuthConfig } = await import('./auth-config');
    expect(() => loadAuthConfig({ AUTH_COOKIE_SECURE: 'false' }, 'production', ORIGIN)).toThrow(
      /AUTH_COOKIE_SECURE/,
    );
    expect(loadAuthConfig({}, 'production', ORIGIN).cookieSecure).toBe(true);
    expect(loadAuthConfig({}, 'development', ORIGIN).cookieSecure).toBe(false);
  });

  it('keeps the idle time within the absolute lifetime and rejects nonsense numbers', async () => {
    const { loadAuthConfig } = await import('./auth-config');
    const cfg = loadAuthConfig(
      { SESSION_MAX_AGE_MS: '3600000', SESSION_IDLE_TIMEOUT_MS: '7200000' },
      'test',
      ORIGIN,
    );
    expect(cfg.sessionIdleMs).toBe(3_600_000);
    expect(() => loadAuthConfig({ LOGIN_MAX_FAILURES: '0' }, 'test', ORIGIN)).toThrow();
    expect(() => loadAuthConfig({ SESSION_MAX_AGE_MS: 'soon' }, 'test', ORIGIN)).toThrow();
  });

  it('the shared test config matches the documented defaults', () => {
    expect(testAuthConfig().minPasswordLength).toBe(12);
  });
});
