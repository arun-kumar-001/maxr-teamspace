import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IAuditLogRepository, PgAuditLogRepository } from './audit-log.repository';
import { createAuditLogRouter } from './audit-log.routes';
import { AuditLogService } from './audit-log.service';

export function createAuditLogs(options: {
  authenticate: RequestHandler;
  repository?: IAuditLogRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository = options.repository ?? new PgAuditLogRepository(options.getPool ?? getPool);
  return { router: createAuditLogRouter(new AuditLogService(repository), options.authenticate) };
}
