import { describe, expect, it } from 'vitest';
import { makeApp, uuid } from '../../test/helpers';
import { agentAs } from '../rbac/rbac.testing';

let n = 0;
type Api = Awaited<ReturnType<typeof agentAs>>;
const create = (api: Api, body: object) =>
  api.post('/api/v1/templates').set('Idempotency-Key', `e2e-key-${++n}-padding`).send(body);

describe('sample module end to end (TC-9-19)', () => {
  it('create, read, update, list, deactivate respect every convention', async () => {
    const { app, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');

    const created = await create(api, { name: '  Alpha  ', description: 'first' });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      name: 'Alpha',
      description: 'first',
      isActive: true,
      ownerId: authKit.users.admin.employeeId,
    });

    const got = await api.get(`/api/v1/templates/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(id);

    const updated = await api.put(`/api/v1/templates/${id}`).send({ description: 'changed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('changed');

    const deactivated = await api.post(`/api/v1/templates/${id}/deactivate`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data).toEqual({ id, isActive: false });

    // Business rule violated: 422, not 400 and not 500.
    const again = await api.post(`/api/v1/templates/${id}/deactivate`);
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('unknown id is 404; an empty update is 400', async () => {
    const { app, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    expect((await api.get(`/api/v1/templates/${uuid}`)).status).toBe(404);
    const c = await create(api, { name: 'x1' });
    const empty = await api.put(`/api/v1/templates/${c.body.data.id}`).send({});
    expect(empty.status).toBe(400);
  });

  it('duplicate name is a clean 409 and no SQL text reaches the client', async () => {
    const { app, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    await create(api, { name: 'Unique' });
    const dup = await create(api, { name: 'unique' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    expect(JSON.stringify(dup.body)).not.toMatch(/templates_name_key|violates|constraint/);
  });

  it('lists with pagination meta, search, filter and allow-listed sorting', async () => {
    const { app, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    for (const name of ['Delta', 'Alpha', 'Charlie', 'Bravo', 'Echo']) {
      await create(api, { name });
    }
    const deactivate = (await api.get('/api/v1/templates?search=echo')).body.data[0].id;
    await api.post(`/api/v1/templates/${deactivate}/deactivate`);

    const page1 = await api.get('/api/v1/templates?pageSize=2&sortBy=name&sortOrder=asc');
    expect(page1.status).toBe(200);
    expect(page1.body.data.map((t: { name: string }) => t.name)).toEqual(['Alpha', 'Bravo']);
    expect(page1.body.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });

    const page3 = await api.get('/api/v1/templates?pageSize=2&page=3&sortBy=name');
    expect(page3.body.data.map((t: { name: string }) => t.name)).toEqual(['Echo']);

    const active = await api.get('/api/v1/templates?isActive=true&pageSize=100');
    expect(active.body.meta.total).toBe(4);
    const inactive = await api.get('/api/v1/templates?isActive=false');
    expect(inactive.body.data.map((t: { name: string }) => t.name)).toEqual(['Echo']);

    const found = await api.get('/api/v1/templates?search=ALP');
    expect(found.body.data).toHaveLength(1);

    const beyond = await api.get('/api/v1/templates?page=99');
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(5);
  });

  it('rejects sorting by a field outside the allow-list and over-large pages', async () => {
    const { app, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    const sort = await api.get('/api/v1/templates?sortBy=ownerId');
    expect(sort.status).toBe(400);
    expect(sort.body.error.details[0].field).toBe('query.sortBy');
    expect((await api.get('/api/v1/templates?pageSize=101')).status).toBe(400);
    expect((await api.get('/api/v1/templates?page=0')).status).toBe(400);
  });

  it('writes an audit entry for every successful write, with the request id, and none for reads', async () => {
    const { app, authKit, auditStore } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    const auditEntries = () => auditStore.list().filter((e) => e.action.startsWith('template.'));
    const created = await create(api, { name: 'Audited' });
    const id = created.body.data.id as string;
    await api
      .put(`/api/v1/templates/${id}`)
      .send({ description: 'secret text must not be logged' });
    await api.post(`/api/v1/templates/${id}/deactivate`);
    await api.get(`/api/v1/templates/${id}`);
    await api.get('/api/v1/templates');

    expect(auditEntries().map((e) => [e.action, e.outcome])).toEqual([
      ['template.create', 'success'],
      ['template.update', 'success'],
      ['template.deactivate', 'success'],
    ]);
    const [first, second] = auditEntries();
    expect(first).toMatchObject({
      entityType: 'template',
      entityId: id,
      actorId: authKit.users.admin.id,
      requestId: created.headers['x-request-id'],
    });
    // Field names only, never the values.
    expect(second?.changes).toEqual({ fields: ['description'] });
    expect(JSON.stringify(auditEntries())).not.toContain('secret text');
  });

  it('records a failed create as a failure entry, and still returns the real error', async () => {
    const { app, authKit, auditStore } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    const auditEntries = () => auditStore.list().filter((e) => e.action.startsWith('template.'));
    await create(api, { name: 'Taken' });
    const duplicate = await create(api, { name: 'taken' });
    expect(duplicate.status).toBe(409);
    expect(auditEntries().map((e) => [e.action, e.outcome])).toEqual([
      ['template.create', 'success'],
      ['template.create', 'failure'],
    ]);
  });

  it('announces template.created only after the create succeeded, and never for a failed create', async () => {
    const { app, authKit, platform } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    const seen: string[] = [];
    platform.events.subscribe(
      'template.created',
      (event) => void seen.push((event.payload as { id: string }).id),
    );
    const ok = await create(api, { name: 'Announced' });
    await create(api, { name: 'announced' }); // duplicate: fails
    expect(seen).toEqual([ok.body.data.id]);
  });

  it('a failing audit store is never swallowed: the request fails with a generic 500', async () => {
    const { app, authKit, auditStore } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    auditStore.failNextWith(new Error('audit database down'));
    const res = await create(api, { name: 'Unaudited' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('audit database down');
  });
});
