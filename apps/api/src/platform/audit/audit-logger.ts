import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Logger } from '../../logging/logger';
import { redact } from '../../logging/redact';
import {
  AuditContext,
  AuditEntry,
  AuditError,
  AuditEventInput,
  AuditLogger,
  AuditStore,
  AuditWriteOptions,
} from './types';

const MAX_JSON_BYTES = 8 * 1024;

const dotted = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const identifier = /^[a-z][a-z0-9_]*$/;

const eventSchema = z.object({
  action: z.string().max(100).regex(dotted, 'must look like module.verb'),
  outcome: z.enum(['success', 'denied', 'failure']),
  entityType: z.string().max(64).regex(identifier),
  entityId: z.string().min(1).max(128).optional(),
  actorId: z.string().min(1).max(128).optional(),
  actorRole: z.string().min(1).max(64).optional(),
  requestId: z.string().min(1).max(64).optional(),
  changes: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Redacts, then replaces the whole value with a marker if it is too large (never cuts mid-value). */
function boundedRedact(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  const clean = redact(value) as Record<string, unknown>;
  const size = Buffer.byteLength(JSON.stringify(clean), 'utf8');
  return size > MAX_JSON_BYTES ? { truncated: true, reason: 'too large', bytes: size } : clean;
}

export interface AuditLoggerOptions {
  store: AuditStore;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
}

export function createAuditLogger(
  options: AuditLoggerOptions,
  context: AuditContext = {},
): AuditLogger {
  const { store, logger } = options;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? randomUUID;

  const build = (input: AuditEventInput): AuditEntry => {
    const merged = { ...context, ...stripUndefined(input) };
    const parsed = eventSchema.safeParse(merged);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new AuditError(`Invalid audit event (${problems})`);
    }
    const { changes, metadata, ...rest } = parsed.data;
    return {
      ...rest,
      changes: boundedRedact(changes),
      metadata: boundedRedact(metadata),
      id: newId(),
      occurredAt: now().toISOString(),
    };
  };

  const record = async (
    input: AuditEventInput,
    writeOptions?: AuditWriteOptions,
  ): Promise<AuditEntry> => {
    const entry = build(input);
    try {
      await store.append(entry, writeOptions);
    } catch (err) {
      logger.error('audit write failed', {
        action: entry.action,
        entityType: entry.entityType,
        err,
      });
      throw new AuditError('The audit entry could not be written');
    }
    return entry;
  };

  return {
    record,
    async tryRecord(input, writeOptions) {
      try {
        return await record(input, writeOptions);
      } catch (err) {
        logger.warn('audit entry skipped', { err });
        return null;
      }
    },
    withContext: (extra) => createAuditLogger(options, { ...context, ...stripUndefined(extra) }),
  };
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
