import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { listRoutes } from './rbac.testing';

/**
 * Public routes are an explicit, reviewed list. Adding to it needs a conscious edit here,
 * so a route cannot become public by accident.
 */
const PUBLIC = [
  'GET /api/v1/health',
  'POST /api/v1/auth/login',
  'GET /api/v1/files/download', // the signed token is the permission
  'GET /api/v1/openapi.json', // development only: not mounted when NODE_ENV=production
];

describe('route inventory (every route declares its access rule)', () => {
  const routes = listRoutes(makeApp().app);
  const label = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

  it('finds the routes of every mounted module', () => {
    const paths = routes.map(label);
    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /api/v1/health',
        'POST /api/v1/auth/login',
        'GET /api/v1/templates',
        'POST /api/v1/templates/:id/deactivate',
      ]),
    );
  });

  it('fails for any route without exactly one of permission / public / authenticated', () => {
    const bad = routes.filter((r) => r.access.length !== 1).map(label);
    expect(
      bad,
      `Routes missing requirePermission(), publicRoute() or authenticatedOnly():`,
    ).toEqual([]);
  });

  it('only the reviewed routes are public', () => {
    const publicRoutes = routes.filter((r) => r.access[0]?.type === 'public').map(label);
    expect(publicRoutes.sort()).toEqual([...PUBLIC].sort());
  });

  it('the sample module and the OpenAPI document are not mounted in production', () => {
    const prod = listRoutes(makeApp({ nodeEnv: 'production' }).app).map(label);
    expect(prod.some((p) => p.includes('/templates') || p.includes('openapi'))).toBe(false);
  });

  it('permission routes name a catalog key (checked at compile time and here)', () => {
    for (const r of routes) {
      const a = r.access[0];
      if (a?.type === 'permission') expect(a.permission).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});
