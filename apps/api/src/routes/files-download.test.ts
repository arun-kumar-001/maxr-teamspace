import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { signInAs } from '../modules/rbac/rbac.testing';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('image bytes'),
]);

/** Through the real route table: the download route must know who is asking. */
describe('signed download links in the real application', () => {
  async function setup() {
    const { app, platform, authKit } = makeApp();
    const owner = await signInAs(app, authKit, 'staff');
    const other = await signInAs(app, authKit, 'admin');
    const file = await platform.storage.upload({
      category: 'attendancePhotos',
      filename: 'p.png',
      declaredType: 'image/png',
      body: PNG,
      uploadedBy: owner.userId,
    });
    const link = await platform.storage.createDownloadLink(file.key, { subject: owner.userId });
    return { app, owner, other, url: link.url };
  }

  it('gives the file to the signed-in person the link was issued to', async () => {
    const s = await setup();
    const res = await s.owner.get(s.url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.from(res.body as Buffer).length).toBeGreaterThan(0);
  });

  it('answers 404 to anyone else who has the link, signed in or not', async () => {
    const s = await setup();
    expect((await s.other.get(s.url)).status).toBe(404);
    const { default: request } = await import('supertest');
    expect((await request(s.app).get(s.url)).status).toBe(404);
  });
});
