import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { captureLogger, makeMiniApp } from '../test/helpers';
import { pdf } from '../test/fixtures';
import { createPlatform, createTestPlatform } from './index';
import { InMemoryAuditStore } from './audit/stores';
import { FakeEmailAdapter } from './notifications/adapters/fake-email-adapter';
import { InMemoryNotificationOutbox } from './notifications/outbox';
import { loadPlatformConfig } from './platform-config';
import { createFilesRouter } from './storage/files.routes';

const SECRET = 'platform-test-secret-platform-test-1234';

describe('configuration (TC-13-34)', () => {
  it('has safe development defaults', () => {
    const config = loadPlatformConfig({});
    expect(config).toMatchObject({
      nodeEnv: 'development',
      email: {
        driver: 'smtp',
        from: 'no-reply@maxr.internal',
        smtp: { host: 'localhost', port: 1025 },
      },
      outbox: { pollIntervalMs: 10_000, maxAttempts: 5 },
      storage: {
        driver: 'local',
        localPath: './uploads',
        maxFileBytes: 10 * 1024 * 1024,
        linkTtlSeconds: 300,
        requireScan: false,
      },
    });
    expect(config.storage.signingSecret).toBeUndefined();
  });

  it('reads values from the environment', () => {
    const config = loadPlatformConfig({
      NODE_ENV: 'test',
      EMAIL_DRIVER: 'sendgrid',
      SENDGRID_API_KEY: 'SG.x',
      EMAIL_FROM: 'hr@maxr.example',
      OUTBOX_MAX_ATTEMPTS: '3',
      STORAGE_DRIVER: 'memory',
      STORAGE_MAX_FILE_SIZE_MB: '2',
      STORAGE_SIGNING_SECRET: SECRET,
      STORAGE_LINK_TTL_SECONDS: '600',
      STORAGE_REQUIRE_SCAN: 'true',
    });
    expect(config.email).toMatchObject({
      driver: 'sendgrid',
      sendgridApiKey: 'SG.x',
      from: 'hr@maxr.example',
    });
    expect(config.outbox.maxAttempts).toBe(3);
    expect(config.storage).toMatchObject({
      driver: 'memory',
      maxFileBytes: 2 * 1024 * 1024,
      linkTtlSeconds: 600,
      requireScan: true,
      signingSecret: SECRET,
    });
  });

  it.each([
    [{ STORAGE_DRIVER: 's3' }, /D-10/],
    [{ STORAGE_DRIVER: 'ftp' }, /local or memory/],
    [{ EMAIL_DRIVER: 'carrier-pigeon' }, /EMAIL_DRIVER/],
    [{ EMAIL_DRIVER: 'sendgrid' }, /SENDGRID_API_KEY/],
    [{ EMAIL_FROM: 'Evil <a@b.c>' }, /EMAIL_FROM/],
    [{ STORAGE_SIGNING_SECRET: 'too-short' }, /32/],
    [{ STORAGE_LINK_TTL_SECONDS: '901' }, /STORAGE_LINK_TTL_SECONDS/],
    [{ STORAGE_LINK_TTL_SECONDS: '0' }, /STORAGE_LINK_TTL_SECONDS/],
    [{ STORAGE_MAX_FILE_SIZE_MB: '0' }, /STORAGE_MAX_FILE_SIZE_MB/],
    [{ STORAGE_MAX_FILE_SIZE_MB: '51' }, /STORAGE_MAX_FILE_SIZE_MB/],
    [{ STORAGE_REQUIRE_SCAN: 'yes' }, /true' or 'false/],
    [{ SMTP_PORT: '0' }, /SMTP_PORT/],
    [{ OUTBOX_MAX_ATTEMPTS: '21' }, /OUTBOX_MAX_ATTEMPTS/],
    [{ OUTBOX_POLL_INTERVAL_MS: '10' }, /OUTBOX_POLL_INTERVAL_MS/],
    [{ NODE_ENV: 'staging' }, /NODE_ENV/],
  ])('rejects %j', (env, message) => {
    expect(() => loadPlatformConfig(env as NodeJS.ProcessEnv)).toThrow(message);
  });
});

describe('production fails closed (TC-13-35)', () => {
  const productionEnv = {
    NODE_ENV: 'production',
    STORAGE_SIGNING_SECRET: SECRET,
    EMAIL_DRIVER: 'smtp',
  };
  const durable = () => ({
    auditStore: new InMemoryAuditStore(),
    outbox: new InMemoryNotificationOutbox(),
    scanner: { scan: async () => ({ clean: true }) },
  });

  it('refuses to start without a durable audit store', () => {
    const { auditStore: _a, ...rest } = durable();
    expect(() =>
      createPlatform({
        config: loadPlatformConfig(productionEnv),
        logger: captureLogger().logger,
        overrides: rest,
      }),
    ).toThrow(/audit store/);
  });

  it('refuses to start without a durable notification outbox', () => {
    const { outbox: _o, ...rest } = durable();
    expect(() =>
      createPlatform({
        config: loadPlatformConfig(productionEnv),
        logger: captureLogger().logger,
        overrides: rest,
      }),
    ).toThrow(/outbox/);
  });

  it('refuses a missing signing secret, the fake email driver and the in-memory storage', () => {
    expect(() => loadPlatformConfig({ NODE_ENV: 'production' })).toThrow(/STORAGE_SIGNING_SECRET/);
    expect(() => loadPlatformConfig({ ...productionEnv, EMAIL_DRIVER: 'fake' })).toThrow(/fake/);
    expect(() => loadPlatformConfig({ ...productionEnv, STORAGE_DRIVER: 'memory' })).toThrow(
      /not allowed in production/,
    );
  });

  it('requires a virus scanner by default', () => {
    const { scanner: _s, ...rest } = durable();
    expect(() =>
      createPlatform({
        config: loadPlatformConfig(productionEnv),
        logger: captureLogger().logger,
        overrides: rest,
      }),
    ).toThrow(/virus scanner/);
  });

  it('starts when everything required is provided', () => {
    expect(() =>
      createPlatform({
        config: loadPlatformConfig({
          ...productionEnv,
          STORAGE_LOCAL_PATH: path.join(os.tmpdir(), 'maxr-prod-check'),
        }),
        logger: captureLogger().logger,
        overrides: durable(),
      }),
    ).not.toThrow();
  });

  it('development starts with no overrides at all', () => {
    expect(() =>
      createPlatform({
        config: loadPlatformConfig({ NODE_ENV: 'development' }),
        logger: captureLogger().logger,
      }),
    ).not.toThrow();
  });
});

describe('everything together, using only fakes (TC-13-36)', () => {
  it('upload -> audit -> event -> email queued and sent -> download link works', async () => {
    const email = new FakeEmailAdapter();
    const log = captureLogger();
    const { platform, auditStore } = createTestPlatform({
      emailAdapter: email,
      logger: log.logger,
    });
    const { audit, events, notifications, storage, dispatcher } = platform;

    // A subscriber turns the event into a notification (this is what module owners write).
    events.subscribe('document.uploaded', async (event) => {
      const { documentKey } = event.payload as { documentKey: string };
      await notifications.enqueueEmail({
        to: ['asha@example.com'],
        subject: 'A document was added to your profile',
        text: 'HR added a document to your profile.',
        dedupeKey: `document:${documentKey}`,
      });
    });

    // 1. The module authorizes, then uploads.
    const file = await storage.upload({
      category: 'employeeDocuments',
      filename: 'offer.pdf',
      declaredType: 'application/pdf',
      body: pdf('offer'),
      uploadedBy: 'hr-1',
    });
    // 2. The module writes the audit entry (fail closed) and announces the event.
    await audit
      .withContext({ actorId: 'hr-1', actorRole: 'hr_manager', requestId: 'req-1' })
      .record({
        action: 'employee_document.upload',
        outcome: 'success',
        entityType: 'employee_document',
        entityId: file.key,
      });
    await events.emit({
      type: 'document.uploaded',
      payload: { documentKey: file.key },
      actorId: 'hr-1',
      requestId: 'req-1',
    });
    // 3. The background dispatcher sends the email.
    expect(await dispatcher.runOnce()).toMatchObject({ claimed: 1, sent: 1 });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      to: ['asha@example.com'],
      subject: 'A document was added to your profile',
    });

    // 4. The employee gets a link and downloads it.
    const link = await storage.createDownloadLink(file.key, { subject: 'emp-1' });
    const { app } = makeMiniApp((a) => {
      a.use((req, _res, next) => {
        req.actor = { id: 'emp-1' };
        next();
      });
      a.use('/api/v1/files', createFilesRouter(storage));
    });
    const res = await request(app).get(link.url);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');

    expect(auditStore.list()).toHaveLength(1);
    expect(auditStore.list()[0]).toMatchObject({
      action: 'employee_document.upload',
      actorId: 'hr-1',
      entityId: file.key,
    });
    // No personal data in any log line.
    expect(log.lines.join('\n')).not.toMatch(/asha@example|offer\.pdf|A document was added/);
  });

  it('a rolled-back action sends no email (events are only announced after commit)', async () => {
    const email = new FakeEmailAdapter();
    const { platform } = createTestPlatform({ emailAdapter: email });
    platform.events.subscribe('leave.approved', async () => {
      await platform.notifications.enqueueEmail({
        to: ['a@example.com'],
        subject: 'Approved',
        text: 'Approved',
      });
    });
    const { EventCollector } = await import('./index');
    const collector = new EventCollector();
    collector.add({ type: 'leave.approved', payload: {} });
    collector.discard(); // the transaction rolled back
    await collector.flush(platform.events);
    expect(await platform.dispatcher.runOnce()).toMatchObject({ claimed: 0 });
    expect(email.sent).toHaveLength(0);
  });

  it('the local disk driver really writes and serves a file end to end', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maxr-e2e-'));
    try {
      const platform = createPlatform({
        config: loadPlatformConfig({
          NODE_ENV: 'development',
          EMAIL_DRIVER: 'fake',
          STORAGE_LOCAL_PATH: dir,
          STORAGE_SIGNING_SECRET: SECRET,
        }),
        logger: captureLogger().logger,
      });
      const body = pdf('on disk');
      const file = await platform.storage.upload({
        category: 'receipts',
        filename: 'r.pdf',
        declaredType: 'application/pdf',
        body,
        uploadedBy: 'u',
      });
      const onDisk = await fs.readFile(path.join(dir, `${file.key}.bin`));
      expect(onDisk.equals(body)).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
