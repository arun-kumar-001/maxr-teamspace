import express, { Express } from 'express';
import { spawnSync } from 'child_process';
import { createApp } from '../app';
import { config } from '../config/env';
import { DependencyStatus } from '../db/types';
import { HealthDependencies } from '../health/health';
import { InMemoryAuditStore } from '../platform/audit/stores';
import { Platform, createTestPlatform } from '../platform';
import { HttpConfig } from '../http/http-config';
import { Logger, createLogger } from '../logging/logger';
import { createErrorHandler } from '../middleware/error-handler';
import { notFoundHandler } from '../middleware/not-found';
import { requestIdMiddleware } from '../middleware/request-id';

export const generousHttp: HttpConfig = {
  trustProxy: 0,
  rateLimit: { windowMs: 60_000, max: 10_000 },
};

/** A logger that records every line so tests can assert on what was (and was not) logged. */
export function captureLogger() {
  const lines: string[] = [];
  const logger: Logger = createLogger({ level: 'debug', write: (line) => lines.push(line) });
  return {
    logger,
    lines,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const up: DependencyStatus = { status: 'up', latencyMs: 1 };

/** Healthy fake probes, so tests never open a real database or Redis connection. */
export const healthyDeps: HealthDependencies = {
  checkDatabase: async () => up,
  checkRedis: async () => up,
};

export function makeApp(
  overrides: {
    http?: HttpConfig;
    nodeEnv?: string;
    logger?: Logger;
    health?: HealthDependencies;
    platform?: Platform;
  } = {},
): {
  app: Express;
  lines: string[];
  records: () => Record<string, unknown>[];
  platform: Platform;
  auditStore: InMemoryAuditStore;
} {
  const captured = captureLogger();
  const testPlatform = createTestPlatform({ logger: captured.logger });
  const platform = overrides.platform ?? testPlatform.platform;
  const app = createApp({
    logger: overrides.logger ?? captured.logger,
    http: overrides.http ?? generousHttp,
    nodeEnv: overrides.nodeEnv ?? 'test',
    health: overrides.health ?? healthyDeps,
    platform,
  });
  return {
    app,
    lines: captured.lines,
    records: captured.records,
    platform,
    auditStore: testPlatform.auditStore,
  };
}

/** Minimal app with the standard chain, for tests that need custom routes. */
export function makeMiniApp(register: (app: Express) => void) {
  const captured = captureLogger();
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1mb' }));
  register(app);
  app.use(notFoundHandler);
  app.use(createErrorHandler(captured.logger));
  return { app, lines: captured.lines, records: captured.records };
}

export const uuid = '3f2b8c1e-5d4a-4b6f-9c0e-7a1d2e3f4a5b';

let dbAvailableCache: boolean | null = null;

/**
 * Synchronously checks whether PostgreSQL is reachable for integration tests.
 * Probes the port once with a short timeout (300ms) and caches the result.
 * Avoids top-level await so tests compile cleanly under CommonJS tsconfig.
 */
export function isDatabaseAvailableSync(): boolean {
  if (dbAvailableCache !== null) {
    return dbAvailableCache;
  }

  try {
    const parsed = new URL(config.DATABASE_URL);
    const host = parsed.hostname || '127.0.0.1';
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;

    const probeCode =
      'const net = require("net"); const s = new net.Socket(); s.setTimeout(300); ' +
      's.on("connect", () => { s.destroy(); process.exit(0); }); ' +
      's.on("error", () => { process.exit(1); }); ' +
      's.on("timeout", () => { s.destroy(); process.exit(1); }); ' +
      `s.connect(${port}, "${host}");`;

    const res = spawnSync(process.execPath, ['-e', probeCode], { timeout: 1000 });
    dbAvailableCache = res.status === 0;
  } catch {
    dbAvailableCache = false;
  }

  return dbAvailableCache;
}
