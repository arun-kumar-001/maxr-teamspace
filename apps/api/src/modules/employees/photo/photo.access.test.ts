import { ROLES } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { createTestAuth } from '../../auth/auth.testing';
import { agentAs } from '../../rbac/rbac.testing';
import { createEmployeePhoto } from './index';
import { MemoryEmployeePhotoRepository } from './photo.repository.memory';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('first picture'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('second picture')]);

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const { users } = kit;
  // Staff reports to the Team Lead; Admin and HR Manager are outside that team.
  const repo = new MemoryEmployeePhotoRepository((id) =>
    id === users.staff.employeeId ? users.team_lead.employeeId : null,
  );
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/employees',
    createEmployeePhoto({ platform, authenticate: kit.auth.authenticate, repository: repo }).router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {
    staff: await agentAs(app, kit, ROLES.STAFF),
    team_lead: await agentAs(app, kit, ROLES.TEAM_LEAD),
    hr_manager: await agentAs(app, kit, ROLES.HR_MANAGER),
    admin: await agentAs(app, kit, ROLES.ADMIN),
  };
  const upload = (who: keyof typeof as, body: Buffer, type = 'image/png') =>
    as[who]
      .put('/api/v1/employees/me/photo')
      .set('Content-Type', type)
      .set('X-Filename', type === 'image/jpeg' ? 'me.jpg' : 'me.png')
      .send(body);
  return { app, as, platform, auditStore, users, repo, upload };
}

describe('employee profile photos', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    const id = '11111111-1111-4111-8111-111111111111';
    for (const [method, path] of [
      ['put', '/api/v1/employees/me/photo'],
      ['delete', '/api/v1/employees/me/photo'],
      ['get', `/api/v1/employees/${id}/photo`],
    ] as const) {
      expect((await request(app)[method](path)).status, `${method} ${path}`).toBe(401);
    }
  });

  it('stores your own photo and serves it at a stable URL with caching headers', async () => {
    const s = await setup();
    const put = await s.upload('staff', PNG);
    expect(put.status).toBe(200);
    expect(put.body.data.photoUrl).toMatch(
      new RegExp(`^/api/v1/employees/${s.users.staff.employeeId}/photo\\?v=\\d+$`),
    );

    const got = await s.as.staff.get(put.body.data.photoUrl);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.headers['cache-control']).toBe('private, max-age=86400');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect((got.body as Buffer).equals(PNG)).toBe(true);
  });

  it('answers 304 when the browser already has this photo', async () => {
    const s = await setup();
    const url = (await s.upload('staff', PNG)).body.data.photoUrl as string;
    const first = await s.as.staff.get(url);
    const again = await s.as.staff.get(url).set('If-None-Match', first.headers.etag as string);
    expect(again.status).toBe(304);
  });

  it('replaces the photo: a new URL, the new image, and the old file is gone', async () => {
    const s = await setup();
    const first = (await s.upload('staff', PNG)).body.data.photoUrl as string;
    const keys: string[] = [];
    const original = s.platform.storage.delete.bind(s.platform.storage);
    s.platform.storage.delete = async (key) => {
      keys.push(key);
      return original(key);
    };
    const second = (await s.upload('staff', JPEG, 'image/jpeg')).body.data.photoUrl as string;

    expect(second).not.toBe(first);
    const got = await s.as.staff.get(second);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect((got.body as Buffer).equals(JPEG)).toBe(true);
    expect(keys).toHaveLength(1);
    expect(await s.platform.storage.exists(keys[0]!)).toBe(false);
  });

  it('removes the photo: 204, then 404, and the stored file is deleted', async () => {
    const s = await setup();
    const url = (await s.upload('staff', PNG)).body.data.photoUrl as string;
    const keys: string[] = [];
    const original = s.platform.storage.delete.bind(s.platform.storage);
    s.platform.storage.delete = async (key) => {
      keys.push(key);
      return original(key);
    };

    expect((await s.as.staff.delete('/api/v1/employees/me/photo')).status).toBe(204);
    expect((await s.as.staff.get(url)).status).toBe(404);
    expect(keys).toHaveLength(1);
    expect(await s.platform.storage.exists(keys[0]!)).toBe(false);
  });

  it('follows employee scope: own for Staff, the team for a Team Lead, everyone for Admin and HR', async () => {
    const s = await setup();
    await s.upload('staff', PNG);
    await s.upload('admin', JPEG, 'image/jpeg');
    const staffUrl = `/api/v1/employees/${s.users.staff.employeeId}/photo`;
    const adminUrl = `/api/v1/employees/${s.users.admin.employeeId}/photo`;

    expect((await s.as.staff.get(staffUrl)).status).toBe(200);
    expect((await s.as.staff.get(adminUrl)).status).toBe(404);
    expect((await s.as.team_lead.get(staffUrl)).status).toBe(200);
    expect((await s.as.team_lead.get(adminUrl)).status).toBe(404);
    expect((await s.as.hr_manager.get(staffUrl)).status).toBe(200);
    expect((await s.as.admin.get(staffUrl)).status).toBe(200);
  });

  it('is only ever your own photo that you change: there is no id to point at someone else', async () => {
    const s = await setup();
    await s.upload('staff', PNG);
    await s.upload('admin', JPEG, 'image/jpeg');
    const before = (
      await s.as.hr_manager.get(`/api/v1/employees/${s.users.staff.employeeId}/photo`)
    ).body as Buffer;
    expect(before.equals(PNG)).toBe(true);
  });

  it.each([
    [
      'a web page named like an image',
      Buffer.from('<html><script>alert(1)</script></html>'),
      'image/png',
    ],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'],
    ['a PDF', Buffer.from('%PDF-1.4 x'), 'application/pdf'],
  ])('refuses %s, and stores nothing', async (_n, body, type) => {
    const s = await setup();
    const res = await s.upload('staff', body, type);
    expect(res.status).toBe(400);
    expect(
      (await s.as.staff.get(`/api/v1/employees/${s.users.staff.employeeId}/photo`)).status,
    ).toBe(404);
  });

  it('refuses a photo over 2 MB and an empty one', async () => {
    const s = await setup();
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await s.upload('staff', big)).status).toBe(413);
    expect((await s.upload('staff', Buffer.alloc(0))).status).toBe(400);
  });

  it('audits changes without recording the image', async () => {
    const s = await setup();
    await s.upload('staff', PNG);
    await s.as.staff.delete('/api/v1/employees/me/photo');
    const actions = s.auditStore
      .find((e) => e.action.startsWith('profile.photo_'))
      .map((e) => e.action);
    expect(actions.sort()).toEqual(['profile.photo_remove', 'profile.photo_update']);
  });

  describe("setting another employee's photo", () => {
    const putFor = (
      s: Awaited<ReturnType<typeof setup>>,
      who: 'staff' | 'team_lead' | 'hr_manager' | 'admin',
      employeeId: string,
    ) =>
      s.as[who]
        .put(`/api/v1/employees/${employeeId}/photo`)
        .set('Content-Type', 'image/png')
        .set('X-Filename', 'them.png')
        .send(PNG);

    it('lets HR and Admin set the photo of an employee, and it serves at that employee URL', async () => {
      const s = await setup();
      s.repo.employees.add(s.users.staff.employeeId);

      for (const who of ['hr_manager', 'admin'] as const) {
        const put = await putFor(s, who, s.users.staff.employeeId);
        expect(put.status, who).toBe(200);
        expect(put.body.data.photoUrl).toMatch(
          new RegExp(`^/api/v1/employees/${s.users.staff.employeeId}/photo\\?v=\\d+$`),
        );
      }
      const got = await s.as.admin.get(`/api/v1/employees/${s.users.staff.employeeId}/photo`);
      expect(got.status).toBe(200);
      expect(s.auditStore.find((e) => e.action === 'employee.photo_update').length).toBe(2);
    });

    it('does not let Staff or a Team Lead set anyone elses photo', async () => {
      const s = await setup();
      s.repo.employees.add(s.users.staff.employeeId);
      s.repo.employees.add(s.users.hr_manager.employeeId);

      expect((await putFor(s, 'staff', s.users.hr_manager.employeeId)).status).toBe(403);
      expect((await putFor(s, 'team_lead', s.users.staff.employeeId)).status).toBe(403);
    });

    it('answers 404 for an employee that does not exist, and removes a photo on request', async () => {
      const s = await setup();
      s.repo.employees.add(s.users.staff.employeeId);
      expect((await putFor(s, 'admin', '11111111-1111-4111-8111-111111111111')).status).toBe(404);

      await putFor(s, 'admin', s.users.staff.employeeId);
      const del = await s.as.admin.delete(`/api/v1/employees/${s.users.staff.employeeId}/photo`);
      expect(del.status).toBe(204);
      expect(
        (await s.as.admin.get(`/api/v1/employees/${s.users.staff.employeeId}/photo`)).status,
      ).toBe(404);
    });
  });
});
