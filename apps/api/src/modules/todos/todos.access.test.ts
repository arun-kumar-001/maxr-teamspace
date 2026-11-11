import { ROLES } from '@maxr/shared';
import express, { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { TEST_PASSWORD, createTestAuth, type TestAuthKit } from '../auth/auth.testing';
import { agentAs } from '../rbac/rbac.testing';
import { InMemoryTodosRepository } from './todos.repository.memory';
import { createTodosRouter } from './todos.routes';
import { TodosService } from './todos.service';

const ORIGIN = 'http://localhost:3000';
const DUMMY_UUID = '10000000-0000-4000-8000-000000000001';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent });
  const kit: TestAuthKit = createTestAuth(platform.audit);
  const repo = new InMemoryTodosRepository();
  const service = new TodosService(repo);
  const todosRouter = createTodosRouter(service, kit.auth.authenticate);

  const app: Express = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/todos', todosRouter);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));

  // Seed a second staff employee to test cross-tenant isolation
  const staffB = {
    id: '00000000-0000-4000-8000-000000000099',
    employeeId: '00000000-0000-4000-9000-000000000099',
    email: 'staff_b@maxr.test',
    passwordHash: '',
    isActive: true,
    employeeStatus: 'active' as const,
    firstName: 'Staff',
    lastName: 'Two',
    roles: [ROLES.STAFF],
  };
  kit.repo.users.set(staffB.id, staffB);

  // Sign in as Staff A, Staff B, and Admin
  const staffAgentA = await agentAs(app, kit, ROLES.STAFF);
  const adminAgent = await agentAs(app, kit, ROLES.ADMIN);

  // Log in as Staff B
  staffB.passwordHash = kit.users.staff.passwordHash;
  const loginResB = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: staffB.email, password: TEST_PASSWORD });
  const staffAgentB = request.agent(app);
  const rawCookie = loginResB.headers['set-cookie'] as unknown as string[];
  staffAgentB
    .set('Cookie', (rawCookie.find((c) => c.startsWith('maxr_session=')) ?? '').split(';')[0] ?? '')
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', loginResB.body.data.csrfToken as string);

  return {
    app,
    repo,
    service,
    staffAgentA,
    staffAgentB,
    adminAgent,
    staffAEmployeeId: kit.users.staff.employeeId,
    staffBEmployeeId: staffB.employeeId,
  };
}

describe('todos API access and authorization', () => {
  it('unauthenticated request returns 401 across all routes', async () => {
    const { app } = await setup();

    const getRes = await request(app).get('/api/v1/todos');
    expect(getRes.status).toBe(401);

    const postRes = await request(app).post('/api/v1/todos').send({ title: 'Test Todo' });
    expect(postRes.status).toBe(401);

    const getOneRes = await request(app).get(`/api/v1/todos/${DUMMY_UUID}`);
    expect(getOneRes.status).toBe(401);

    const patchRes = await request(app).patch(`/api/v1/todos/${DUMMY_UUID}`).send({ title: 'New' });
    expect(patchRes.status).toBe(401);

    const toggleRes = await request(app).post(`/api/v1/todos/${DUMMY_UUID}/toggle`);
    expect(toggleRes.status).toBe(401);

    const deleteRes = await request(app).delete(`/api/v1/todos/${DUMMY_UUID}`);
    expect(deleteRes.status).toBe(401);
  });

  it("Staff A cannot access Staff B's to-do; expected 404 with no existence leak", async () => {
    const { staffAgentA, staffAgentB } = await setup();

    // Staff B creates a personal to-do
    const createRes = await staffAgentB.post('/api/v1/todos').send({
      title: "Staff B's secret task",
      dueDate: '2026-12-01',
    });
    expect(createRes.status).toBe(201);
    const todoId = createRes.body.data.id;

    // Staff A cannot get Staff B's to-do (404)
    const getRes = await staffAgentA.get(`/api/v1/todos/${todoId}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error?.message).toMatch(/not found/i);

    // Staff A cannot update Staff B's to-do (404)
    const patchRes = await staffAgentA.patch(`/api/v1/todos/${todoId}`).send({
      title: 'Hacked title',
    });
    expect(patchRes.status).toBe(404);

    // Staff A cannot toggle Staff B's to-do (404)
    const toggleRes = await staffAgentA.post(`/api/v1/todos/${todoId}/toggle`);
    expect(toggleRes.status).toBe(404);

    // Staff A cannot delete Staff B's to-do (404)
    const deleteRes = await staffAgentA.delete(`/api/v1/todos/${todoId}`);
    expect(deleteRes.status).toBe(404);

    // Staff A listing todos does not include Staff B's to-do
    const listRes = await staffAgentA.get('/api/v1/todos');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);
    expect(listRes.body.meta.total).toBe(0);
  });

  it("Admin cannot access Staff A's personal to-do; expected 404", async () => {
    const { staffAgentA, adminAgent } = await setup();

    // Staff A creates a personal to-do
    const createRes = await staffAgentA.post('/api/v1/todos').send({
      title: "Staff A's personal task",
      dueDate: '2026-11-20',
    });
    expect(createRes.status).toBe(201);
    const todoId = createRes.body.data.id;

    // Admin cannot get Staff A's personal to-do (404)
    const getRes = await adminAgent.get(`/api/v1/todos/${todoId}`);
    expect(getRes.status).toBe(404);

    // Admin cannot update Staff A's personal to-do (404)
    const patchRes = await adminAgent.patch(`/api/v1/todos/${todoId}`).send({
      title: 'Admin override',
    });
    expect(patchRes.status).toBe(404);

    // Admin cannot delete Staff A's personal to-do (404)
    const deleteRes = await adminAgent.delete(`/api/v1/todos/${todoId}`);
    expect(deleteRes.status).toBe(404);

    // Admin listing todos returns only Admin's own todos (none so far)
    const listRes = await adminAgent.get('/api/v1/todos');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);
    expect(listRes.body.meta.total).toBe(0);
  });

  it('pagination limits and metadata are correctly enforced', async () => {
    const { staffAgentA } = await setup();

    // Seed 5 to-dos for Staff A
    for (let i = 1; i <= 5; i++) {
      await staffAgentA.post('/api/v1/todos').send({
        title: `Task #${i}`,
      });
    }

    // Default pagination (limit 50, offset 0)
    const defaultRes = await staffAgentA.get('/api/v1/todos');
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.data).toHaveLength(5);
    expect(defaultRes.body.meta).toEqual({
      total: 5,
      limit: 50,
      offset: 0,
      hasMore: false,
    });

    // Custom limit = 2, offset = 0
    const page1Res = await staffAgentA.get('/api/v1/todos?limit=2&offset=0');
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data).toHaveLength(2);
    expect(page1Res.body.meta).toEqual({
      total: 5,
      limit: 2,
      offset: 0,
      hasMore: true,
    });

    // Custom limit = 2, offset = 4 (last page)
    const lastPageRes = await staffAgentA.get('/api/v1/todos?limit=2&offset=4');
    expect(lastPageRes.status).toBe(200);
    expect(lastPageRes.body.data).toHaveLength(1);
    expect(lastPageRes.body.meta).toEqual({
      total: 5,
      limit: 2,
      offset: 4,
      hasMore: false,
    });
  });

  it('invalid pagination values return validation errors', async () => {
    const { staffAgentA } = await setup();

    // Negative limit
    const negLimit = await staffAgentA.get('/api/v1/todos?limit=-1');
    expect(negLimit.status).toBe(422);

    // Limit exceeding 100
    const overLimit = await staffAgentA.get('/api/v1/todos?limit=150');
    expect(overLimit.status).toBe(422);

    // Non-numeric limit
    const nanLimit = await staffAgentA.get('/api/v1/todos?limit=abc');
    expect(nanLimit.status).toBe(422);

    // Negative offset
    const negOffset = await staffAgentA.get('/api/v1/todos?offset=-1');
    expect(negOffset.status).toBe(422);

    // Non-integer offset
    const floatOffset = await staffAgentA.get('/api/v1/todos?offset=1.5');
    expect(floatOffset.status).toBe(422);
  });
});
