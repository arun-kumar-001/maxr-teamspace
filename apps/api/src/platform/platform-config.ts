export type EmailDriver = 'smtp' | 'sendgrid' | 'fake';
export type StorageDriver = 'local' | 'memory';

export const MAX_LINK_TTL_SECONDS = 900;

export interface PlatformConfig {
  nodeEnv: 'development' | 'test' | 'production';
  email: {
    driver: EmailDriver;
    from: string;
    smtp: { host: string; port: number; user?: string; pass?: string };
    sendgridApiKey?: string;
  };
  outbox: { pollIntervalMs: number; maxAttempts: number };
  storage: {
    driver: StorageDriver;
    localPath: string;
    maxFileBytes: number;
    /** Undefined in development: a random per-process secret is generated. */
    signingSecret?: string;
    linkTtlSeconds: number;
    requireScan: boolean;
  };
}

function fail(message: string): never {
  throw new Error(`[Config Error] ${message}`);
}

function readInt(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}, got '${raw}'`);
  }
  return value;
}

function readBool(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fail(`${name} must be 'true' or 'false', got '${raw}'`);
}

/** Reads and validates the settings for audit, notifications and storage. Fails fast. */
export function loadPlatformConfig(env: NodeJS.ProcessEnv = process.env): PlatformConfig {
  const nodeEnv = (env.NODE_ENV || 'development') as PlatformConfig['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    fail(`Invalid NODE_ENV: ${nodeEnv}`);
  }
  const production = nodeEnv === 'production';

  const emailDriver = (env.EMAIL_DRIVER || 'smtp') as EmailDriver;
  if (!['smtp', 'sendgrid', 'fake'].includes(emailDriver)) {
    fail(`EMAIL_DRIVER must be smtp, sendgrid or fake, got '${emailDriver}'`);
  }
  if (production && emailDriver === 'fake') {
    fail('EMAIL_DRIVER=fake is not allowed in production');
  }
  const sendgridApiKey = env.SENDGRID_API_KEY || undefined;
  if (emailDriver === 'sendgrid' && !sendgridApiKey) {
    fail('SENDGRID_API_KEY is required when EMAIL_DRIVER=sendgrid');
  }
  const from = env.EMAIL_FROM || 'no-reply@maxr.internal';
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
    fail('EMAIL_FROM must be a plain email address');
  }

  const storageDriver = (env.STORAGE_DRIVER || 'local') as string;
  if (storageDriver === 's3') {
    fail(
      "STORAGE_DRIVER=s3 is not implemented yet: the Cantobo storage API is still open (decision D-10, see docs/architecture/shared-services.md). Use 'local' or 'memory'.",
    );
  }
  if (!['local', 'memory'].includes(storageDriver)) {
    fail(`STORAGE_DRIVER must be local or memory, got '${storageDriver}'`);
  }
  if (production && storageDriver !== 'local') {
    fail(`STORAGE_DRIVER=${storageDriver} is not allowed in production (not durable)`);
  }

  const signingSecret = env.STORAGE_SIGNING_SECRET || undefined;
  if (signingSecret !== undefined && signingSecret.length < 32) {
    fail('STORAGE_SIGNING_SECRET must be at least 32 characters');
  }
  if (production && !signingSecret) {
    fail('STORAGE_SIGNING_SECRET is required in production');
  }

  const smtpPort = readInt('SMTP_PORT', env.SMTP_PORT, 1025, 1, 65535);

  return {
    nodeEnv,
    email: {
      driver: emailDriver,
      from,
      smtp: {
        host: env.SMTP_HOST || 'localhost',
        port: smtpPort,
        user: env.SMTP_USER || undefined,
        pass: env.SMTP_PASS || undefined,
      },
      sendgridApiKey,
    },
    outbox: {
      pollIntervalMs: readInt(
        'OUTBOX_POLL_INTERVAL_MS',
        env.OUTBOX_POLL_INTERVAL_MS,
        10_000,
        1000,
        3_600_000,
      ),
      maxAttempts: readInt('OUTBOX_MAX_ATTEMPTS', env.OUTBOX_MAX_ATTEMPTS, 5, 1, 20),
    },
    storage: {
      driver: storageDriver as StorageDriver,
      localPath: env.STORAGE_LOCAL_PATH || './uploads',
      maxFileBytes:
        readInt('STORAGE_MAX_FILE_SIZE_MB', env.STORAGE_MAX_FILE_SIZE_MB, 10, 1, 50) * 1024 * 1024,
      signingSecret,
      linkTtlSeconds: readInt(
        'STORAGE_LINK_TTL_SECONDS',
        env.STORAGE_LINK_TTL_SECONDS,
        300,
        1,
        MAX_LINK_TTL_SECONDS,
      ),
      requireScan: readBool('STORAGE_REQUIRE_SCAN', env.STORAGE_REQUIRE_SCAN, production),
    },
  };
}
