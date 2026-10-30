import express, { Express } from 'express';
import { createApp } from '../app';
import { DependencyStatus } from '../db/types';
import { HealthDependencies } from '../health/health';
import { InMemoryAuditStore } from '../platform/audit/stores';
import { Platform, createTestPlatform } from '../platform';
import { ReportRegistry } from '../modules/reports';
import { TestAuthKit, createTestAuth } from '../modules/auth/auth.testing';
import { HttpConfig } from '../http/http-config';
import { Logger, createLogger } from '../logging/logger';
import { createErrorHandler } from '../middleware/error-handler';
import { notFoundHandler } from '../middleware/not-found';
import { requestIdMiddleware } from '../middleware/request-id';

export const generousHttp: HttpConfig = {
  trustProxy: 0,
  rateLimit: { windowMs: 60_000, max: 10_000 },
  loginRateLimit: { windowMs: 60_000, max: 10_000 },
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
    /** `loginRateLimit` defaults to a generous limit so only login tests need to set it. */
    http?: Omit<HttpConfig, 'loginRateLimit'> & Partial<Pick<HttpConfig, 'loginRateLimit'>>;
    nodeEnv?: string;
    logger?: Logger;
    health?: HealthDependencies;
    platform?: Platform;
    auth?: TestAuthKit;
    reportRegistry?: ReportRegistry;
  } = {},
): {
  app: Express;
  lines: string[];
  records: () => Record<string, unknown>[];
  platform: Platform;
  auditStore: InMemoryAuditStore;
  authKit: TestAuthKit;
} {
  const captured = captureLogger();
  const testPlatform = createTestPlatform({ logger: captured.logger });
  const platform = overrides.platform ?? testPlatform.platform;
  const authKit = overrides.auth ?? createTestAuth(platform.audit);
  const app = createApp({
    logger: overrides.logger ?? captured.logger,
    http: { ...generousHttp, ...overrides.http },
    nodeEnv: overrides.nodeEnv ?? 'test',
    health: overrides.health ?? healthyDeps,
    platform,
    auth: authKit.auth,
    reportRegistry: overrides.reportRegistry,
  });
  return {
    app,
    lines: captured.lines,
    records: captured.records,
    platform,
    auditStore: testPlatform.auditStore,
    authKit,
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
