import fs from 'fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { buildOpenApiDocument } from './build-spec';
import { OPENAPI_OUTPUT, renderOpenApiJson } from './generate';

describe('OpenAPI (TC-9-18)', () => {
  const doc = buildOpenApiDocument() as any;

  it('is an OpenAPI 3.0 document that lists the sample module', () => {
    expect(doc.openapi).toMatch(/^3\.0\./);
    expect(doc.info.title).toBe('MAXR Teamspace API');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/templates', '/templates/{id}', '/templates/{id}/deactivate']),
    );
  });

  it('documents the standard error envelope on every operation', () => {
    expect(doc.components.schemas.ErrorEnvelope).toBeTruthy();
    for (const path of Object.values<any>(doc.paths)) {
      for (const op of Object.values<any>(path)) {
        expect(op.responses['400']).toBeTruthy();
        expect(op.responses['429']).toBeTruthy();
        expect(op.responses['500']).toBeTruthy();
      }
    }
  });

  it('documents the Idempotency-Key header only on the idempotent endpoint', () => {
    const headerNames = (op: any) =>
      (op.parameters ?? []).filter((p: any) => p.in === 'header').map((p: any) => p.name);
    expect(headerNames(doc.paths['/templates'].post)).toContain('Idempotency-Key');
    expect(headerNames(doc.paths['/templates'].get)).toEqual([]);
  });

  it('documents pagination query parameters with the max page size', () => {
    const params = doc.paths['/templates'].get.parameters as any[];
    const pageSize = params.find((p) => p.name === 'pageSize');
    expect(pageSize.schema.maximum).toBe(100);
    expect(pageSize.schema.default).toBe(20);
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
