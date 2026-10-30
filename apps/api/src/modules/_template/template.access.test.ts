import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../http/idempotency';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { uuid } from '../../test/helpers';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, SignedIn, expectNoExistenceLeak, signInAs } from '../rbac/rbac.testing';
import { TemplateRepository } from './template.repository';
import { createTemplateRouter } from './template.routes';

/**
 * The sample module runs on the employees.* permissions and treats a template's owner as an
 * employee, so it shows each scope end to end. Staff reports to the team lead; the admin and
 * HR manager are outside that team.
 */
async function setup() {
  const { platform } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const kit = createTestAuth(platform.audit);
  const { users } = kit;
  const managerOf = (employeeId: string) =>
    employeeId === users.staff.employeeId ? users.team_lead.employeeId : null;
  const repo = new TemplateRepository(managerOf);

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/templates',
    createTemplateRouter(new InMemoryIdempotencyStore(), platform, kit.auth.authenticate, repo),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  // One template owned by each role's employee.
  const ids = {} as Record<Role, string>;
  for (const role of ALL_ROLES) {
    ids[role] = (await repo.create({ name: `owned by ${role}` }, users[role].employeeId)).id;
  }
  return { app, as, ids };
}

describe('sample module access (TC-8)', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/templates'],
      ['get', `/api/v1/templates/${uuid}`],
      ['post', '/api/v1/templates'],
      ['put', `/api/v1/templates/${uuid}`],
      ['post', `/api/v1/templates/${uuid}/deactivate`],
    ] as const) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  const CREATE: Array<[Role, number]> = [
    ['admin', 201],
    ['hr_manager', 201],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(CREATE)('%s creating gets %i (employees.create)', async (role, status) => {
    const { as } = await setup();
    const res = await as[role]
      .post('/api/v1/templates', { name: 'new one' })
      .set('Idempotency-Key', `key-${role}-12345678`);
    expect(res.status).toBe(status);
  });

  const DEACTIVATE: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(DEACTIVATE)('%s deactivating gets %i (employees.deactivate)', async (role, status) => {
    const { as, ids } = await setup();
    const res = await as[role].post(`/api/v1/templates/${ids.admin}/deactivate`);
    expect(res.status).toBe(status);
  });

  // Which records each role sees in the list: admin and HR all four, the team lead only the
  // staff member's (a direct report), staff cannot list at all.
  const LIST: Array<[Role, number | 'denied', Role[]]> = [
    ['admin', 200, ['admin', 'hr_manager', 'team_lead', 'staff']],
    ['hr_manager', 200, ['admin', 'hr_manager', 'team_lead', 'staff']],
    ['team_lead', 200, ['staff']],
    ['staff', 'denied', []],
  ];
  it.each(LIST)('%s lists only records in scope', async (role, status, owners) => {
    const { as } = await setup();
    const res = await as[role].get('/api/v1/templates?pageSize=100');
    if (status === 'denied') {
      expect(res.status).toBe(403);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { name: string }) => t.name).sort()).toEqual(
      owners.map((o) => `owned by ${o}`).sort(),
    );
    expect(res.body.meta.total).toBe(owners.length);
  });

  // GET /:id: 200 inside the scope, 404 (not 403) outside it, with no difference from "missing".
  const READ: Array<[Role, Role, 200 | 404]> = [
    ['admin', 'staff', 200],
    ['hr_manager', 'admin', 200],
    ['team_lead', 'staff', 200],
    ['team_lead', 'hr_manager', 404],
    ['team_lead', 'team_lead', 404], // team scope is direct reports, not the lead's own record
    ['staff', 'staff', 200],
    ['staff', 'team_lead', 404],
    ['staff', 'admin', 404],
  ];
  it.each(READ)('%s reading the record of %s gets %i', async (role, owner, status) => {
    const { as, ids } = await setup();
    const res = await as[role].get(`/api/v1/templates/${ids[owner]}`);
    expect(res.status).toBe(status);
    if (status === 404) {
      expectNoExistenceLeak(res, await as[role].get(`/api/v1/templates/${uuid}`));
    }
  });
});
