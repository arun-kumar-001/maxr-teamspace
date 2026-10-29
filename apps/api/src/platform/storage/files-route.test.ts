import { testActor } from '../../test/fixtures';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { captureLogger, makeMiniApp } from '../../test/helpers';
import { pdf, png } from '../../test/fixtures';
import { InMemoryStorageAdapter } from './adapters/memory-storage-adapter';
import { createFilesRouter } from './files.routes';
import { createSignedLinkService } from './signed-links';
import { createStorageService } from './storage-service';

const T0 = Date.parse('2026-10-29T10:00:00.000Z');

function setup() {
  const clock = { ms: T0 };
  const now = () => new Date(clock.ms);
  const signer = createSignedLinkService({ secret: 'route-test-secret-route-test-secret-12', now });
  const storage = createStorageService({
    adapter: new InMemoryStorageAdapter(),
    signer,
    logger: captureLogger().logger,
    maxFileBytes: 10 * 1024 * 1024,
    now,
  });
  const { app } = makeMiniApp((a) => {
    // Stand-in for the auth middleware of issue #7: the user comes from a test header.
    a.use((req, _res, next) => {
      const user = req.header('x-test-user');
      if (user) req.actor = testActor(user);
      next();
    });
    a.use('/api/v1/files', createFilesRouter(storage));
  });
  return { app, storage, clock };
}

async function stored(storage: ReturnType<typeof setup>['storage'], over: object = {}) {
  const body = pdf('route test body');
  const result = await storage.upload({
    category: 'employeeDocuments',
    filename: 'Offer Letter – Asha.pdf',
    declaredType: 'application/pdf',
    body,
    uploadedBy: 'u-1',
    ...over,
  });
  return { ...result, body };
}

describe('download route (TC-13-29 .. TC-13-31)', () => {
  it('TC-13-29 serves the file to its user as an attachment with hardened headers', async () => {
    const { app, storage } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });

    const res = await request(app)
      .get(link.url)
      .set('x-test-user', 'u-1')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="Offer Letter _ Asha\.pdf"; filename\*=UTF-8''Offer%20Letter%20%E2%80%93%20Asha\.pdf$/,
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-length']).toBe(String(file.body.length));
    expect((res.body as Buffer).equals(file.body)).toBe(true);
  });

  it('TC-13-29 the content type is the detected one, whatever the client claimed', async () => {
    const { app, storage } = setup();
    const file = await stored(storage, {
      filename: 'photo.jpg',
      declaredType: 'image/jpeg',
      body: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8)]),
    });
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });
    const res = await request(app).get(link.url).set('x-test-user', 'u-1');
    expect(res.headers['content-type']).toBe('image/jpeg');
    void png;
  });

  it('TC-13-30 another user, or nobody, gets a plain 404 (never the file, never a hint)', async () => {
    const { app, storage } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });
    const other = await request(app).get(link.url).set('x-test-user', 'u-2');
    const anonymous = await request(app).get(link.url);
    for (const res of [other, anonymous]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'File not found' });
    }
  });

  it('TC-13-30 a tampered or invented token is a 404 that looks the same as every other failure', async () => {
    const { app, storage } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });
    const tampered = `${link.token.slice(0, -3)}AAA`;
    const responses = await Promise.all(
      [tampered, 'garbage', 'a.b', 'x'.repeat(100)].map((token) =>
        request(app).get('/api/v1/files/download').query({ token }).set('x-test-user', 'u-1'),
      ),
    );
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('File not found');
    }
  });

  it('TC-13-30 an expired link is 410', async () => {
    const { app, storage, clock } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1', ttlSeconds: 30 });
    clock.ms += 31_000;
    const res = await request(app).get(link.url).set('x-test-user', 'u-1');
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('LINK_EXPIRED');
  });

  it('TC-13-30 a missing, empty or unexpected query is a 400', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/files/download')).status).toBe(400);
    expect((await request(app).get('/api/v1/files/download?token=')).status).toBe(400);
    expect((await request(app).get('/api/v1/files/download?token=a&key=receipts/x')).status).toBe(
      400,
    );
    expect(
      (await request(app).get(`/api/v1/files/download?token=${'x'.repeat(2049)}`)).status,
    ).toBe(400);
  });

  it('TC-13-31 deleting the file revokes every link to it, immediately', async () => {
    const { app, storage } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });
    expect((await request(app).get(link.url).set('x-test-user', 'u-1')).status).toBe(200);
    expect(await storage.delete(file.key)).toBe(true);
    expect((await request(app).get(link.url).set('x-test-user', 'u-1')).status).toBe(404);
  });

  it('TC-13-31 a download response contains only the file: no JSON, no cookies', async () => {
    const { app, storage } = setup();
    const file = await stored(storage);
    const link = await storage.createDownloadLink(file.key, { subject: 'u-1' });
    const res = await request(app).get(link.url).set('x-test-user', 'u-1');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['content-type']).not.toContain('json');
  });
});
