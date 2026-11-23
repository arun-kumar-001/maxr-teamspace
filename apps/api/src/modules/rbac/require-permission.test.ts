import express, { Request } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../middleware/error-handler';
import { createLogger } from '../../logging/logger';
import { requestIdMiddleware } from '../../middleware/request-id';
import { accessFor, authenticatedOnly, publicRoute, requirePermission } from './require-permission';

function appWith(actor?: Request['actor']) {
  const app = express();
  app.use(requestIdMiddleware);
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.get('/team', requirePermission('employees.list'), (req, res) => {
    res.json(accessFor(req));
  });
  app.get('/open', publicRoute(), (_req, res) => res.json({ ok: true }));
  app.get('/me', authenticatedOnly(), (_req, res) => res.json({ ok: true }));
  app.get('/forgot', (req, res) => res.json(accessFor(req)));
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));
  return app;
}

const actor = (roles: Array<'admin' | 'hr_manager' | 'team_lead' | 'staff'>) => ({
  id: 'u1',
  employeeId: 'e1',
  role: roles[0] ?? 'staff',
  roles,
});

describe('requirePermission', () => {
  it('401 without a session', async () => {
    const res = await request(appWith()).get('/team');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('403 for a role without the permission, with a generic message', async () => {
    const res = await request(appWith(actor(['staff']))).get('/team');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain('employees.list');
  });

  it('403 for a user with no roles at all (deny by default)', async () => {
    expect((await request(appWith(actor([]))).get('/team')).status).toBe(403);
  });

  it('passes the decision and the scope filter on', async () => {
    const res = await request(appWith(actor(['team_lead']))).get('/team');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      permission: 'employees.list',
      scope: 'team',
      filter: { kind: 'team', managerId: 'e1' },
    });
  });

  it('uses the widest scope of several roles', async () => {
    const res = await request(appWith(actor(['team_lead', 'hr_manager']))).get('/team');
    expect(res.body.filter).toEqual({ kind: 'all' });
  });
});

describe('route markers', () => {
  it('public routes need nothing; authenticated-only routes need a session', async () => {
    expect((await request(appWith()).get('/open')).status).toBe(200);
    expect((await request(appWith()).get('/me')).status).toBe(401);
    expect((await request(appWith(actor(['staff']))).get('/me')).status).toBe(200);
  });

  it('a controller that runs without the guard fails loudly (500), never open', async () => {
    const res = await request(appWith(actor(['admin']))).get('/forgot');
    expect(res.status).toBe(500);
  });
});
