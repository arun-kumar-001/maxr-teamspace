import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { createErrorHandler } from '../middleware/error-handler';
import { readRawUpload, rawUploadParser } from './raw-upload';
import { asyncHandler } from './async-handler';

function app() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const server = express();
  server.use(express.json({ limit: '1mb' }));
  server.post(
    '/upload',
    rawUploadParser(1024),
    asyncHandler(async (req, res) => {
      const upload = readRawUpload(req);
      res.json({ size: upload.body.length, filename: upload.filename, type: upload.declaredType });
    }),
  );
  server.use(createErrorHandler(silent));
  return server;
}

describe('raw file uploads', () => {
  it('reads the bytes, the decoded filename and the declared type', async () => {
    const res = await request(app())
      .post('/upload')
      .set('Content-Type', 'application/pdf')
      .set('X-Filename', 'Q3%20r%C3%A9sum%C3%A9.pdf')
      .send(Buffer.from('%PDF-1.4 hello'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ size: 14, filename: 'Q3 résumé.pdf', type: 'application/pdf' });
  });

  it('refuses a body over the limit with 413 while reading', async () => {
    const res = await request(app())
      .post('/upload')
      .set('Content-Type', 'application/pdf')
      .set('X-Filename', 'big.pdf')
      .send(Buffer.alloc(2048, 1));
    expect(res.status).toBe(413);
  });

  it.each([
    [
      'no body',
      () =>
        request(app())
          .post('/upload')
          .set('Content-Type', 'application/pdf')
          .set('X-Filename', 'a.pdf'),
    ],
    [
      'no filename',
      () =>
        request(app())
          .post('/upload')
          .set('Content-Type', 'application/pdf')
          .send(Buffer.from('x')),
    ],
    [
      'a filename that is not percent-encoded properly',
      () =>
        request(app())
          .post('/upload')
          .set('Content-Type', 'application/pdf')
          .set('X-Filename', '%E0%A4%A')
          .send(Buffer.from('x')),
    ],
  ])('refuses %s with 400', async (_name, send) => {
    expect((await send()).status).toBe(400);
  });

  it('refuses a JSON body: a file is sent as bytes, not as JSON', async () => {
    const res = await request(app())
      .post('/upload')
      .set('X-Filename', 'a.pdf')
      .send({ file: 'JVBERi0=' });
    expect(res.status).toBe(400);
  });
});
