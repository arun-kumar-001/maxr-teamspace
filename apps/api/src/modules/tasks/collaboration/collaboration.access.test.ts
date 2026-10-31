import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../../http/idempotency';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { InMemoryStorageAdapter } from '../../../platform/storage/adapters/memory-storage-adapter';
import { createTestAuth } from '../../auth/auth.testing';
import {
  ALL_ROLES,
  SignedIn,
  agentAs,
  expectNoExistenceLeak,
  listRoutes,
  signInAs,
} from '../../rbac/rbac.testing';
import { createTasks } from '../index';
import { MemoryTasksRepository } from '../tasks.repository.memory';
import { MemoryCollaborationRepository } from './collaboration.repository.memory';
import type { NewAttachment, StoredAttachment } from './collaboration.types';

const MISSING = '8a000000-0000-4000-8000-000000000999';

const pdf = (text = 'one') => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);
const png = (text = 'one') =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(text)]);

class FlakyCollaborationRepository extends MemoryCollaborationRepository {
  failInsert = false;
  override async insertAttachment(
    ...args: Parameters<MemoryCollaborationRepository['insertAttachment']>
  ): Promise<StoredAttachment> {
    if (this.failInsert) throw new Error('database down');
    return super.insertAttachment(...(args as [never, NewAttachment]));
  }
}

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const adapter = new InMemoryStorageAdapter();
  let scanVerdict = true;
  const { platform, auditStore } = createTestPlatform({
    logger: silent,
    storageAdapter: adapter,
    scanner: { scan: async () => ({ clean: scanVerdict }) },
  });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;
  const tasksRepo = new MemoryTasksRepository();
  tasksRepo.people = {
    [id('staff')]: { name: 'Sam Staff', status: 'active', managerId: id('team_lead') },
    [id('team_lead')]: { name: 'Lee Lead', status: 'active', managerId: null },
    [id('hr_manager')]: { name: 'Hana HR', status: 'active', managerId: null },
    [id('admin')]: { name: 'Ada Admin', status: 'active', managerId: null },
  };
  const collab = new FlakyCollaborationRepository();
  collab.names = Object.fromEntries(Object.entries(tasksRepo.people).map(([k, v]) => [k, v.name]));
  const events: Array<{ type: string; payload: unknown }> = [];
  platform.events.subscribe(
    'tasks.commented',
    (e) => void events.push({ type: e.type, payload: e.payload }),
  );
  const tasks = createTasks({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () => ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
      }),
    },
    projects: { access: async () => null },
    repository: tasksRepo,
    collaborationRepository: collab,
    clock: () => new Date('2026-10-31T10:00:00Z'),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/tasks', tasks.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  // Uploads send raw bytes, so they use a plain signed-in agent instead of the JSON helpers.
  const agents = {} as Record<Role, Awaited<ReturnType<typeof agentAs>>>;
  for (const role of ALL_ROLES) agents[role] = await agentAs(app, kit, role);

  let n = 0;
  // A task the Team Lead assigned to Staff.
  const task = async (assigner: Role = 'team_lead', assignee: Role = 'staff') =>
    (
      await as[assigner]
        .post('/api/v1/tasks', { title: 'Prepare the report', assigneeEmployeeId: id(assignee) })
        .set('Idempotency-Key', `t-${++n}-abcdefgh`)
    ).body.data.id as string;
  const upload = (
    who: Role,
    taskId: string,
    body: Buffer,
    type = 'application/pdf',
    name = 'report.pdf',
  ) =>
    agents[who]
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Content-Type', type)
      .set('X-Filename', encodeURIComponent(name))
      .send(body);
  const comment = (who: Role, taskId: string, body: string) =>
    as[who].post(`/api/v1/tasks/${taskId}/comments`, { body });
  return {
    app,
    as,
    agents,
    kit,
    id,
    adapter,
    collab,
    platform,
    auditStore,
    events,
    task,
    upload,
    comment,
    setScan: (clean: boolean) => void (scanVerdict = clean),
  };
}

describe('task collaboration API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    const t = MISSING;
    for (const [method, path] of [
      ['get', `/api/v1/tasks/${t}/comments`],
      ['post', `/api/v1/tasks/${t}/comments`],
      ['get', `/api/v1/tasks/${t}/attachments`],
      ['post', `/api/v1/tasks/${t}/attachments`],
      ['get', `/api/v1/tasks/${t}/attachments/${t}/download-link`],
      ['delete', `/api/v1/tasks/${t}/attachments/${t}`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) =>
      /\/tasks\/:id\/(comments|attachments)/.test(r.path),
    );
    expect(routes).toHaveLength(6);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe('comments', () => {
    it('lets the assignee, the assigner, the assignee’s manager and an Admin read and write the thread', async () => {
      const { task, comment, as } = await setup();
      const taskId = await task('admin', 'staff'); // the Team Lead only manages the assignee
      for (const who of ['staff', 'team_lead', 'admin'] as Role[]) {
        expect((await comment(who, taskId, `from ${who}`)).status, who).toBe(201);
      }
      const thread = await as.staff.get(`/api/v1/tasks/${taskId}/comments`);
      expect(thread.body.data.map((c: { body: string }) => c.body)).toEqual([
        'from staff',
        'from team_lead',
        'from admin',
      ]);
      expect(thread.body.data[0]).toMatchObject({ authorName: 'Sam Staff', taskId });
      expect(thread.body.meta.total).toBe(3);
    });

    it('is out of reach of someone who cannot see the task, with the 404 of a missing task', async () => {
      const { task, comment, as } = await setup();
      const taskId = await task();
      expectNoExistenceLeak(
        await comment('hr_manager', taskId, 'hello'),
        await comment('hr_manager', MISSING, 'hello'),
      );
      expect((await as.hr_manager.get(`/api/v1/tasks/${taskId}/comments`)).status).toBe(404);
    });

    it('pages the thread', async () => {
      const { task, comment, as } = await setup();
      const taskId = await task();
      for (const text of ['a', 'b', 'c']) await comment('staff', taskId, text);
      const page = await as.staff.get(`/api/v1/tasks/${taskId}/comments?pageSize=2&page=2`);
      expect(page.body.data.map((c: { body: string }) => c.body)).toEqual(['c']);
      expect((await as.staff.get(`/api/v1/tasks/${taskId}/comments?pageSize=1000`)).status).toBe(
        400,
      );
    });

    it.each([
      ['a blank comment', { body: '   ' }],
      ['a comment over 2000 characters', { body: 'x'.repeat(2001) }],
      ['an unknown field', { body: 'ok', authorEmployeeId: MISSING }],
      ['no body', {}],
    ])('rejects %s with 400', async (_name, payload) => {
      const { task, as } = await setup();
      const taskId = await task();
      expect((await as.staff.post(`/api/v1/tasks/${taskId}/comments`, payload)).status).toBe(400);
    });

    it('tells the other party without the text, and keeps the text out of the audit trail', async () => {
      const { task, comment, events, auditStore, id } = await setup();
      const taskId = await task();
      await comment('staff', taskId, 'a very private remark');
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toMatchObject({
        taskId,
        authorEmployeeId: id('staff'),
        assigneeEmployeeId: id('staff'),
        assignerEmployeeId: id('team_lead'),
      });
      expect(JSON.stringify(events)).not.toContain('private remark');
      const entries = auditStore.find((e) => e.action === 'task.comment');
      expect(entries).toHaveLength(1);
      expect(JSON.stringify(entries)).not.toContain('private remark');
    });
  });

  describe('attachments', () => {
    it('stores a PDF, answers with its metadata only, and lists it', async () => {
      const { task, upload, as, adapter, id } = await setup();
      const taskId = await task();
      const res = await upload('staff', taskId, pdf(), 'application/pdf', 'Q3 report é.pdf');
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        taskId,
        originalName: 'Q3 report é.pdf',
        contentType: 'application/pdf',
        size: pdf().length,
        uploadedByEmployeeId: id('staff'),
        uploadedByName: 'Sam Staff',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/storageKey|sha256|task-attachments/);
      expect(adapter.size).toBe(1);
      const list = await as.team_lead.get(`/api/v1/tasks/${taskId}/attachments`);
      expect(list.body.data).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toMatch(/storageKey|sha256|task-attachments/);
    });

    it('accepts PNG and JPEG, and refuses other types by their content', async () => {
      const { task, upload } = await setup();
      const taskId = await task();
      expect((await upload('staff', taskId, png(), 'image/png', 'a.png')).status).toBe(201);
      const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg')]);
      expect((await upload('staff', taskId, jpeg, 'image/jpeg', 'a.jpg')).status).toBe(201);
      expect(
        (await upload('staff', taskId, Buffer.from('plain text'), 'text/plain', 'a.txt')).status,
      ).toBe(400);
      expect(
        (await upload('staff', taskId, Buffer.from('MZ\u0090 program'), 'application/pdf', 'a.pdf'))
          .status,
      ).toBe(400);
      // The content is a PNG but the client says PDF.
      expect((await upload('staff', taskId, png('two'), 'application/pdf', 'b.png')).status).toBe(
        400,
      );
    });

    it('refuses the same file twice on a task with 409, and stores it once', async () => {
      const { task, upload, adapter } = await setup();
      const taskId = await task();
      expect((await upload('staff', taskId, pdf())).status).toBe(201);
      expect((await upload('team_lead', taskId, pdf(), 'application/pdf', 'copy.pdf')).status).toBe(
        409,
      );
      expect(adapter.size).toBe(1);
      expect((await upload('staff', taskId, pdf('different'))).status).toBe(201);
      // The same file on another task is fine.
      const other = await task();
      expect((await upload('staff', other, pdf())).status).toBe(201);
    });

    it('refuses a missing body, a missing filename and a JSON body with 400', async () => {
      const { task, agents, as } = await setup();
      const taskId = await task();
      const url = `/api/v1/tasks/${taskId}/attachments`;
      expect(
        (
          await agents.staff
            .post(url)
            .set('Content-Type', 'application/pdf')
            .set('X-Filename', 'a.pdf')
        ).status,
      ).toBe(400);
      expect(
        (await agents.staff.post(url).set('Content-Type', 'application/pdf').send(pdf())).status,
      ).toBe(400);
      expect(
        (await as.staff.post(url, { file: 'JVBERi0=' }).set('X-Filename', 'a.pdf')).status,
      ).toBe(400);
    });

    it('refuses a body over 10 MB with 413 and stores nothing', async () => {
      const { task, upload, adapter } = await setup();
      const taskId = await task();
      const big = Buffer.concat([pdf(), Buffer.alloc(10 * 1024 * 1024)]);
      expect((await upload('staff', taskId, big)).status).toBe(413);
      expect(adapter.size).toBe(0);
    });

    it('refuses a file the virus scan rejects with 422, and stores and records nothing', async () => {
      const { task, upload, adapter, collab, setScan } = await setup();
      const taskId = await task();
      setScan(false);
      expect((await upload('staff', taskId, pdf('infected'))).status).toBe(422);
      expect(adapter.size).toBe(0);
      expect(collab.attachments).toHaveLength(0);
    });

    it('holds at most 20 files per task, and removes the object it had already stored for the 21st', async () => {
      const { task, upload, adapter } = await setup();
      const taskId = await task();
      for (let i = 0; i < 20; i += 1) {
        expect((await upload('staff', taskId, pdf(`file ${i}`))).status, String(i)).toBe(201);
      }
      expect((await upload('staff', taskId, pdf('file 21'))).status).toBe(422);
      expect(adapter.size).toBe(20);
    });

    it('removes the stored object when recording it fails', async () => {
      const { task, upload, adapter, collab } = await setup();
      const taskId = await task();
      collab.failInsert = true;
      expect((await upload('staff', taskId, pdf())).status).toBe(500);
      expect(adapter.size).toBe(0);
      collab.failInsert = false;
      expect((await upload('staff', taskId, pdf())).status).toBe(201);
    });

    it('is out of reach of someone who cannot see the task: a 404, and nothing is stored', async () => {
      const { task, upload, adapter, as } = await setup();
      const taskId = await task();
      expectNoExistenceLeak(
        await upload('hr_manager', taskId, pdf()),
        await upload('hr_manager', MISSING, pdf()),
      );
      expect(adapter.size).toBe(0);
      expect((await as.hr_manager.get(`/api/v1/tasks/${taskId}/attachments`)).status).toBe(404);
    });

    it('keeps the file name out of the audit trail', async () => {
      const { task, upload, auditStore } = await setup();
      const taskId = await task();
      await upload('staff', taskId, pdf(), 'application/pdf', 'Acme merger plan.pdf');
      const entries = auditStore.find((e) => e.action === 'task.attachment_add');
      expect(entries).toHaveLength(1);
      expect(JSON.stringify(entries)).not.toContain('Acme');
      expect(entries[0]?.metadata).toMatchObject({ contentType: 'application/pdf' });
    });
  });

  describe('downloading', () => {
    it('gives a visible party a link that opens the file for them alone', async () => {
      const { task, upload, as, platform, kit } = await setup();
      const taskId = await task();
      const attachment = (await upload('staff', taskId, pdf('contents'))).body.data;
      const res = await as.team_lead.get(
        `/api/v1/tasks/${taskId}/attachments/${attachment.id}/download-link`,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.url).toMatch(/^\/api\/v1\/files\/download\?token=/);
      const token = decodeURIComponent(res.body.data.url.split('token=')[1]);
      const opened = await platform.storage.openDownload(token, {
        subject: kit.users.team_lead.id,
      });
      expect(opened.ok).toBe(true);
      if (opened.ok) expect(opened.file.body.toString()).toContain('contents');
      // The link was issued to the Team Lead's session; someone else's does not open it.
      const other = await platform.storage.openDownload(token, { subject: kit.users.staff.id });
      expect(other.ok).toBe(false);
    });

    it('answers 404 for a stranger, an unknown file and a file of another task', async () => {
      const { task, upload, as } = await setup();
      const taskId = await task();
      const otherTask = await task();
      const attachment = (await upload('staff', taskId, pdf())).body.data;
      const link = (t: string, a: string) => `/api/v1/tasks/${t}/attachments/${a}/download-link`;
      expect((await as.hr_manager.get(link(taskId, attachment.id))).status).toBe(404);
      expect((await as.staff.get(link(taskId, MISSING))).status).toBe(404);
      expect((await as.staff.get(link(otherTask, attachment.id))).status).toBe(404);
      expect((await as.staff.get(link(taskId, 'x'))).status).toBe(400);
    });
  });

  describe('removing', () => {
    it('lets the uploader, the assigner and an Admin remove a file, and deletes the stored object', async () => {
      const { task, upload, as, adapter } = await setup();
      for (const remover of ['staff', 'team_lead', 'admin'] as Role[]) {
        const taskId = await task();
        const attachment = (await upload('staff', taskId, pdf(`by ${remover}`))).body.data;
        expect(
          (await as[remover].delete(`/api/v1/tasks/${taskId}/attachments/${attachment.id}`)).status,
          remover,
        ).toBe(200);
        expect((await as.staff.get(`/api/v1/tasks/${taskId}/attachments`)).body.data).toHaveLength(
          0,
        );
      }
      expect(adapter.size).toBe(0);
    });

    it('does not let the assignee remove a file the assigner attached (403)', async () => {
      const { task, upload, as, adapter } = await setup();
      const taskId = await task();
      const attachment = (await upload('team_lead', taskId, pdf())).body.data;
      expect(
        (await as.staff.delete(`/api/v1/tasks/${taskId}/attachments/${attachment.id}`)).status,
      ).toBe(403);
      expect(adapter.size).toBe(1);
    });

    it('answers 404 for a stranger and for a file that is not there', async () => {
      const { task, upload, as } = await setup();
      const taskId = await task();
      const attachment = (await upload('staff', taskId, pdf())).body.data;
      expect(
        (await as.hr_manager.delete(`/api/v1/tasks/${taskId}/attachments/${attachment.id}`)).status,
      ).toBe(404);
      expect((await as.staff.delete(`/api/v1/tasks/${taskId}/attachments/${MISSING}`)).status).toBe(
        404,
      );
    });

    it('still succeeds, and logs, when the stored object cannot be deleted', async () => {
      const { task, upload, as, adapter, collab } = await setup();
      const taskId = await task();
      const attachment = (await upload('staff', taskId, pdf())).body.data;
      adapter.delete = async () => {
        throw new Error('storage down');
      };
      expect(
        (await as.staff.delete(`/api/v1/tasks/${taskId}/attachments/${attachment.id}`)).status,
      ).toBe(200);
      expect(collab.attachments).toHaveLength(0);
    });
  });
});
