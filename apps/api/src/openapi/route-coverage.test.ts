import { describe, expect, it } from 'vitest';
import { listRoutes } from '../modules/rbac/rbac.testing';
import { makeApp } from '../test/helpers';
import { buildOpenApiDocument } from './build-spec';

/** Express `:id` becomes OpenAPI `{id}`, and the /api/v1 prefix is the server's base path. */
const toOpenApiPath = (path: string) =>
  path.replace(/^\/api\/v1/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}');

/** Routes deliberately left out of the published spec. Adding one needs a reason here. */
const UNDOCUMENTED = new Set<string>([
  'GET /openapi.json', // the spec itself
]);

describe('OpenAPI covers every route (AGENTS.md section 5)', () => {
  it('documents each mounted route, so a new endpoint cannot ship undocumented', () => {
    const spec = buildOpenApiDocument() as unknown as {
      paths: Record<string, Record<string, unknown>>;
    };
    const documented = new Set(
      Object.entries(spec.paths).flatMap(([path, ops]) =>
        Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`),
      ),
    );

    const missing = listRoutes(makeApp().app)
      .map((r) => `${r.method} ${toOpenApiPath(r.path)}`)
      .filter((route) => !documented.has(route) && !UNDOCUMENTED.has(route))
      .sort();

    expect(
      missing,
      'Routes with no OpenAPI entry (add a *.openapi.ts and import it in build-spec.ts)',
    ).toEqual([]);
  });
});
