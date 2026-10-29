import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp, uuid } from '../../test/helpers';

let n = 0;
const create = (app: Parameters<typeof request>[0], body: object) =>
  request(app)
    .post('/api/v1/templates')
    .set('Idempotency-Key', `e2e-key-${++n}-padding`)
    .send(body);

describe('sample module end to end (TC-9-19)', () => {
  it('create, read, update, list, deactivate respect every convention', async () => {
    const { app } = makeApp();

    const created = await create(app, { name: '  Alpha  ', description: 'first' });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      name: 'Alpha',
      description: 'first',
      isActive: true,
      ownerId: 'system',
    });

    const got = await request(app).get(`/api/v1/templates/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(id);

    const updated = await request(app)
      .put(`/api/v1/templates/${id}`)
      .send({ description: 'changed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('changed');

    const deactivated = await request(app).post(`/api/v1/templates/${id}/deactivate`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data).toEqual({ id, isActive: false });

    // Business rule violated: 422, not 400 and not 500.
    const again = await request(app).post(`/api/v1/templates/${id}/deactivate`);
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('unknown id is 404; an empty update is 400', async () => {
    const { app } = makeApp();
    expect((await request(app).get(`/api/v1/templates/${uuid}`)).status).toBe(404);
    const c = await create(app, { name: 'x1' });
    const empty = await request(app).put(`/api/v1/templates/${c.body.data.id}`).send({});
    expect(empty.status).toBe(400);
  });

  it('duplicate name is a clean 409 and no SQL text reaches the client', async () => {
    const { app } = makeApp();
    await create(app, { name: 'Unique' });
    const dup = await create(app, { name: 'unique' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    expect(JSON.stringify(dup.body)).not.toMatch(/templates_name_key|violates|constraint/);
  });

  it('lists with pagination meta, search, filter and allow-listed sorting', async () => {
    const { app } = makeApp();
    for (const name of ['Delta', 'Alpha', 'Charlie', 'Bravo', 'Echo']) {
      await create(app, { name });
    }
    const deactivate = (await request(app).get('/api/v1/templates?search=echo')).body.data[0].id;
    await request(app).post(`/api/v1/templates/${deactivate}/deactivate`);

    const page1 = await request(app).get('/api/v1/templates?pageSize=2&sortBy=name&sortOrder=asc');
    expect(page1.status).toBe(200);
    expect(page1.body.data.map((t: { name: string }) => t.name)).toEqual(['Alpha', 'Bravo']);
    expect(page1.body.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });

    const page3 = await request(app).get('/api/v1/templates?pageSize=2&page=3&sortBy=name');
    expect(page3.body.data.map((t: { name: string }) => t.name)).toEqual(['Echo']);

    const active = await request(app).get('/api/v1/templates?isActive=true&pageSize=100');
    expect(active.body.meta.total).toBe(4);
    const inactive = await request(app).get('/api/v1/templates?isActive=false');
    expect(inactive.body.data.map((t: { name: string }) => t.name)).toEqual(['Echo']);

    const found = await request(app).get('/api/v1/templates?search=ALP');
    expect(found.body.data).toHaveLength(1);

    const beyond = await request(app).get('/api/v1/templates?page=99');
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(5);
  });

  it('rejects sorting by a field outside the allow-list and over-large pages', async () => {
    const { app } = makeApp();
    const sort = await request(app).get('/api/v1/templates?sortBy=ownerId');
    expect(sort.status).toBe(400);
    expect(sort.body.error.details[0].field).toBe('query.sortBy');
    expect((await request(app).get('/api/v1/templates?pageSize=101')).status).toBe(400);
    expect((await request(app).get('/api/v1/templates?page=0')).status).toBe(400);
  });
});
