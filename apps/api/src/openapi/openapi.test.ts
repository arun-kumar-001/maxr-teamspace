import fs from 'fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { at, objectAt } from '../test/at';
import { makeApp } from '../test/helpers';
import { buildOpenApiDocument } from './build-spec';
import { OPENAPI_OUTPUT, renderOpenApiJson } from './generate';

describe('OpenAPI (TC-9-18)', () => {
  const doc: unknown = buildOpenApiDocument();

  /** Names of the header parameters documented for one operation. */
  const headerNames = (...operationPath: string[]): string[] => {
    const parameters = at(doc, ...operationPath, 'parameters');
    return (Array.isArray(parameters) ? parameters : [])
      .filter((p): p is { in: string; name: string } => at(p, 'in') === 'header')
      .map((p) => p.name);
  };

  it('is an OpenAPI 3.0 document that lists the sample module', () => {
    expect(at(doc, 'openapi')).toMatch(/^3\.0\./);
    expect(at(doc, 'info', 'title')).toBe('MAXR Teamspace API');
    expect(Object.keys(objectAt(doc, 'paths'))).toEqual(
      expect.arrayContaining(['/templates', '/templates/{id}', '/templates/{id}/deactivate']),
    );
  });

  it('documents the standard error envelope on every operation', () => {
    expect(at(doc, 'components', 'schemas', 'ErrorEnvelope')).toBeTruthy();
    for (const pathItem of Object.values(objectAt(doc, 'paths'))) {
      for (const operation of Object.values(objectAt(pathItem))) {
        for (const status of ['400', '429', '500']) {
          expect(at(operation, 'responses', status)).toBeTruthy();
        }
      }
    }
  });

  it('documents the Idempotency-Key header only on the idempotent endpoint', () => {
    expect(headerNames('paths', '/templates', 'post')).toContain('Idempotency-Key');
    expect(headerNames('paths', '/templates', 'get')).toEqual([]);
  });

  it('documents pagination query parameters with the max page size', () => {
    const params = at(doc, 'paths', '/templates', 'get', 'parameters');
    const pageSize = (Array.isArray(params) ? params : []).find(
      (p) => at(p, 'name') === 'pageSize',
    );
    expect(at(pageSize, 'schema', 'maximum')).toBe(100);
    expect(at(pageSize, 'schema', 'default')).toBe(20);
  });

  it('the committed docs/architecture/openapi.json is up to date (run `npm run openapi:generate`)', () => {
    expect(fs.readFileSync(OPENAPI_OUTPUT, 'utf-8')).toBe(renderOpenApiJson());
  });

  it('is served at /api/v1/openapi.json outside production', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/templates']).toBeTruthy();
  });

  it('SECURITY: the spec and the sample module are not exposed in production', async () => {
    const { app } = makeApp({ nodeEnv: 'production' });
    expect((await request(app).get('/api/v1/openapi.json')).status).toBe(404);
    expect((await request(app).get('/api/v1/templates')).status).toBe(404);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});
