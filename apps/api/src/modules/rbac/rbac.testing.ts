import { ROLES, type Role } from '@maxr/shared';
import type { Express } from 'express';
import request from 'supertest';
import type { TestAuthKit } from '../auth/auth.testing';
import { TEST_PASSWORD } from '../auth/auth.testing';
import { RouteAccess, accessOf } from './require-permission';

const ORIGIN = 'http://localhost:3000';

export interface SignedIn {
  role: Role;
  /** The signed-in user's ids in the test auth kit. */
  userId: string;
  employeeId: string;
  get(path: string): request.Test;
  post(path: string, body?: object): request.Test;
  put(path: string, body?: object): request.Test;
  delete(path: string): request.Test;
}

/**
 * Signs in as the seeded test user of a role and returns request helpers that carry the session
 * cookie and the CSRF token. Use one per role in a table-driven test.
 */
export async function signInAs(app: Express, kit: TestAuthKit, role: Role): Promise<SignedIn> {
  const user = kit.users[role];
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: user.email, password: TEST_PASSWORD });
  if (login.status !== 200) {
    throw new Error(`Test sign-in as ${role} failed with ${login.status}`);
  }
  const raw = login.headers['set-cookie'] as unknown as string[];
  const cookie = (raw.find((c) => c.startsWith('maxr_session=')) ?? '').split(';')[0] ?? '';
  const csrf = login.body.data.csrfToken as string;
  const base = (req: request.Test) => req.set('Cookie', cookie).set('Origin', ORIGIN);
  const write = (req: request.Test) => base(req).set('X-CSRF-Token', csrf);
  return {
    role,
    userId: user.id,
    employeeId: user.employeeId,
    get: (path) => base(request(app).get(path)),
    post: (path, body) => write(request(app).post(path)).send(body ?? {}),
    put: (path, body) => write(request(app).put(path)).send(body ?? {}),
    delete: (path) => write(request(app).delete(path)),
  };
}

export const ALL_ROLES: Role[] = Object.values(ROLES);

/** IDOR check: a record outside the caller's scope must look exactly like one that does not exist. */
export function expectNoExistenceLeak(outOfScope: request.Response, missing: request.Response) {
  if (outOfScope.status !== 404) {
    throw new Error(`Expected 404 for an out-of-scope record, got ${outOfScope.status}`);
  }
  if (JSON.stringify(stripIds(outOfScope.body)) !== JSON.stringify(stripIds(missing.body))) {
    throw new Error('Out-of-scope and missing records are distinguishable by their response body');
  }
}

const stripIds = (body: { error?: { requestId?: string } }) => ({
  ...body,
  error: body.error ? { ...body.error, requestId: undefined } : undefined,
});

export interface RouteEntry {
  method: string;
  path: string;
  access: RouteAccess[];
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
  name: string;
  handle: { stack?: Layer[] };
  regexp: RegExp & { fast_slash?: boolean };
}

const mountOf = (layer: Layer): string => {
  if (layer.regexp.fast_slash) return '';
  const source = layer.regexp.source
    .replace('\\/?(?=\\/|$)', '')
    .replace(/^\^/, '')
    .replace(/\\\//g, '/');
  return source.startsWith('/') ? source : `/${source}`;
};

/** Every route registered on an Express 4 app with the access rule(s) declared on the route itself. */
export function listRoutes(app: Express): RouteEntry[] {
  const out: RouteEntry[] = [];
  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const access = layer.route.stack
          .map((s) => accessOf(s.handle))
          .filter((a): a is RouteAccess => a !== undefined);
        for (const method of Object.keys(layer.route.methods)) {
          out.push({
            method: method.toUpperCase(),
            path: `${prefix}${layer.route.path === '/' ? '' : layer.route.path}` || '/',
            access,
          });
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountOf(layer));
      }
    }
  };
  const root = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  walk(root, '');
  return out;
}

/**
 * A supertest agent already signed in as `role`: it keeps the session cookie and sends the
 * CSRF token and Origin on every call, so existing tests can use it like `request(app)`.
 */
export async function agentAs(app: Express, kit: TestAuthKit, role: Role) {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: kit.users[role].email, password: TEST_PASSWORD });
  if (login.status !== 200) {
    throw new Error(`Test sign-in as ${role} failed with ${login.status}`);
  }
  const agent = request.agent(app);
  const raw = login.headers['set-cookie'] as unknown as string[];
  agent
    .set('Cookie', (raw.find((c) => c.startsWith('maxr_session=')) ?? '').split(';')[0] ?? '')
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', login.body.data.csrfToken as string);
  return agent;
}
