import { Logger, getLogger } from '../logging/logger';
import { createAuditLogger } from './audit/audit-logger';
import { InMemoryAuditStore, LoggerAuditStore } from './audit/stores';
import { AuditLogger, AuditStore } from './audit/types';
import { EventBus, InProcessEventBus } from './events/event-bus';
import { createEmailAdapter } from './notifications/adapters';
import { OutboxDispatcher, createOutboxDispatcher } from './notifications/dispatcher';
import {
  NotificationService,
  createNotificationService,
} from './notifications/notification-service';
import { InMemoryNotificationOutbox } from './notifications/outbox';
import { EmailAdapter, NotificationOutbox } from './notifications/types';
import { PlatformConfig, loadPlatformConfig } from './platform-config';
import { InMemoryStorageAdapter } from './storage/adapters/memory-storage-adapter';
import { LocalDiskStorageAdapter } from './storage/adapters/local-disk-storage-adapter';
import { createSignedLinkService, randomSigningSecret } from './storage/signed-links';
import { StorageService, createStorageService } from './storage/storage-service';
import { Scanner, StorageAdapter } from './storage/types';

/** What modules receive. They depend on these interfaces only, never on SMTP, SendGrid or Cantobo. */
export interface PlatformServices {
  audit: AuditLogger;
  events: EventBus;
  notifications: NotificationService;
  storage: StorageService;
}

export interface Platform extends PlatformServices {
  config: PlatformConfig;
  dispatcher: OutboxDispatcher;
}

/** Replace parts of the platform: tests pass fakes; production passes the durable SQL stores (issue #6). */
export interface PlatformOverrides {
  auditStore?: AuditStore;
  outbox?: NotificationOutbox;
  emailAdapter?: EmailAdapter;
  storageAdapter?: StorageAdapter;
  scanner?: Scanner;
  now?: () => Date;
}

export interface CreatePlatformOptions {
  config?: PlatformConfig;
  logger?: Logger;
  overrides?: PlatformOverrides;
}

/**
 * Builds the shared services. In production it fails closed: it refuses to start on non-durable
 * stand-ins, because a silent fallback would lose audit entries and queued emails.
 */
export function createPlatform({
  config = loadPlatformConfig(),
  logger = getLogger(),
  overrides = {},
}: CreatePlatformOptions = {}): Platform {
  const production = config.nodeEnv === 'production';

  if (production && !overrides.auditStore) {
    throw new Error(
      'A durable audit store is required in production (the SQL store arrives with issue #6)',
    );
  }
  if (production && !overrides.outbox) {
    throw new Error(
      'A durable notification outbox is required in production (the SQL outbox arrives with issues #6/#41)',
    );
  }

  const auditStore = overrides.auditStore ?? new LoggerAuditStore(logger);
  const audit = createAuditLogger({ store: auditStore, logger, now: overrides.now });

  const events = new InProcessEventBus(logger);

  const outbox = overrides.outbox ?? new InMemoryNotificationOutbox();
  const emailAdapter = overrides.emailAdapter ?? createEmailAdapter(config.email);
  const notifications = createNotificationService({ outbox, logger, now: overrides.now });
  const dispatcher = createOutboxDispatcher({
    outbox,
    email: emailAdapter,
    logger,
    maxAttempts: config.outbox.maxAttempts,
  });

  const storageAdapter: StorageAdapter =
    overrides.storageAdapter ??
    (config.storage.driver === 'memory'
      ? new InMemoryStorageAdapter()
      : new LocalDiskStorageAdapter(config.storage.localPath));
  const signer = createSignedLinkService({
    secret: config.storage.signingSecret ?? randomSigningSecret(),
    defaultTtlSeconds: config.storage.linkTtlSeconds,
    now: overrides.now,
  });
  const storage = createStorageService({
    adapter: storageAdapter,
    signer,
    logger,
    maxFileBytes: config.storage.maxFileBytes,
    scanner: overrides.scanner,
    requireScan: config.storage.requireScan,
    now: overrides.now,
  });

  return { config, audit, events, notifications, storage, dispatcher };
}

/** In-memory platform for tests: no files, no network, no database. */
export function createTestPlatform(
  overrides: PlatformOverrides & { logger?: Logger; env?: NodeJS.ProcessEnv } = {},
) {
  const { logger, env, ...rest } = overrides;
  const auditStore = rest.auditStore ?? new InMemoryAuditStore();
  const outbox = rest.outbox ?? new InMemoryNotificationOutbox();
  const platform = createPlatform({
    config: loadPlatformConfig({
      NODE_ENV: 'test',
      EMAIL_DRIVER: 'fake',
      STORAGE_DRIVER: 'memory',
      STORAGE_SIGNING_SECRET: 'test-signing-secret-test-signing-secret',
      ...env,
    }),
    logger,
    overrides: { ...rest, auditStore, outbox },
  });
  return {
    platform,
    auditStore: auditStore as InMemoryAuditStore,
    outbox: outbox as InMemoryNotificationOutbox,
  };
}

export type { AuditLogger, AuditEventInput, AuditEntry } from './audit/types';
export type { EventBus, DomainEvent } from './events/event-bus';
export type { NotificationService } from './notifications/notification-service';
export type { StorageService } from './storage/storage-service';
export { EventCollector } from './events/event-bus';
export { SqlAuditStore } from './audit/sql-audit-store';
export { SqlNotificationOutbox } from './notifications/sql-notification-outbox';
