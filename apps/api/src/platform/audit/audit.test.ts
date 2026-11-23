import { describe, expect, it } from 'vitest';
import { captureLogger } from '../../test/helpers';
import { createAuditLogger } from './audit-logger';
import { InMemoryAuditStore, LoggerAuditStore } from './stores';
import { AuditError, AuditEventInput, AuditStore } from './types';

const fixedNow = () => new Date('2026-10-29T10:00:00.000Z');

function setup() {
  const store = new InMemoryAuditStore();
  const log = captureLogger();
  const audit = createAuditLogger({
    store,
    logger: log.logger,
    now: fixedNow,
    newId: () => 'id-1',
  });
  return { store, audit, log };
}

const valid: AuditEventInput = {
  action: 'employee.deactivate',
  outcome: 'success',
  entityType: 'employee',
  entityId: 'e-1',
  actorId: 'u-1',
  actorRole: 'hr_manager',
  requestId: 'req-1',
};

describe('audit logger (TC-13-01 .. TC-13-07)', () => {
  it('TC-13-01 records an entry with id, UTC time, actor, action, entity and outcome', async () => {
    const { audit, store } = setup();
    const entry = await audit.record(valid);
    expect(entry).toMatchObject({ ...valid, id: 'id-1', occurredAt: '2026-10-29T10:00:00.000Z' });
    expect(store.list()).toEqual([entry]);
  });

  it.each([
    ['an action without a module prefix', { action: 'deactivate' }],
    ['an action in upper case', { action: 'Employee.Deactivate' }],
    ['an action with spaces', { action: 'employee deactivate' }],
    ['an unknown outcome', { outcome: 'maybe' }],
    ['a missing entity type', { entityType: '' }],
    ['an entity type with a slash', { entityType: 'a/b' }],
    ['an over-long entity id', { entityId: 'x'.repeat(129) }],
  ])('TC-13-02 rejects %s and stores nothing', async (_label, patch) => {
    const { audit, store } = setup();
    await expect(audit.record({ ...valid, ...patch } as AuditEventInput)).rejects.toBeInstanceOf(
      AuditError,
    );
    expect(store.list()).toHaveLength(0);
  });

  it('TC-13-03 redacts metadata and changes by field name and by secrets inside text', async () => {
    const { audit } = setup();
    const entry = await audit.record({
      ...valid,
      metadata: {
        password: 'p',
        reason: 'login failed password=hunter2',
        nested: { apiKey: 'k', ok: 'fine' },
      },
      changes: { bankAccount: { from: '1', to: '2' }, status: { from: 'a', to: 'b' } },
    });
    const text = JSON.stringify(entry);
    expect(text).not.toMatch(/hunter2|"p"|"k"|"1"|"2"/);
    expect(entry.metadata).toMatchObject({
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', ok: 'fine' },
    });
    expect(entry.changes).toMatchObject({
      bankAccount: '[REDACTED]',
      status: { from: 'a', to: 'b' },
    });
  });

  it('TC-13-03 replaces oversize metadata with a marker, never a half-cut value', async () => {
    const { audit } = setup();
    const manyFields = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`field${i}`, 'x'.repeat(200)]),
    );
    const entry = await audit.record({ ...valid, metadata: manyFields });
    expect(entry.metadata).toMatchObject({ truncated: true, reason: 'too large' });
    expect(JSON.stringify(entry).length).toBeLessThan(1000);
  });

  it('TC-13-03 a single huge string is cut to a safe length by the redactor', async () => {
    const { audit } = setup();
    const entry = await audit.record({ ...valid, metadata: { blob: 'x'.repeat(20_000) } });
    expect(String(entry.metadata?.blob).length).toBeLessThan(2100);
  });

  it('TC-13-04 record() fails closed when the store fails, with a generic error', async () => {
    const { audit, store, log } = setup();
    store.failNextWith(new Error('connection to db.internal refused'));
    const error = await audit.record(valid).catch((e: Error) => e);
    expect(error).toBeInstanceOf(AuditError);
    expect((error as Error).message).not.toContain('db.internal');
    expect(log.lines.join('\n')).toContain('audit write failed');
  });

  it('TC-13-04 tryRecord() never throws; it logs and returns null', async () => {
    const { audit, store, log } = setup();
    store.failNextWith(new Error('disk full'));
    expect(await audit.tryRecord(valid)).toBeNull();
    expect(log.lines.join('\n')).toContain('audit entry skipped');
    // Invalid input is also swallowed, not thrown.
    expect(await audit.tryRecord({ ...valid, action: 'bad' })).toBeNull();
    // And it still works afterwards.
    expect(await audit.tryRecord(valid)).not.toBeNull();
  });

  it('TC-13-05 is append only: no update or delete exists on the logger or the store', () => {
    const { audit, store } = setup();
    for (const target of [audit, store]) {
      const names = [
        ...Object.keys(target),
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(target)),
      ];
      expect(names.filter((n) => /update|delete|remove|clear|truncate/i.test(n))).toEqual([]);
    }
  });

  it('TC-13-06 withContext fills in actor and request id; explicit values win', async () => {
    const { audit, store } = setup();
    const scoped = audit.withContext({ actorId: 'u-9', actorRole: 'admin', requestId: 'req-9' });
    await scoped.record({
      action: 'role.change',
      outcome: 'success',
      entityType: 'user',
      entityId: 'u-2',
    });
    await scoped.record({
      action: 'role.change',
      outcome: 'denied',
      entityType: 'user',
      actorId: 'u-override',
    });
    expect(store.list()[0]).toMatchObject({
      actorId: 'u-9',
      actorRole: 'admin',
      requestId: 'req-9',
    });
    expect(store.list()[1]).toMatchObject({ actorId: 'u-override', requestId: 'req-9' });
    // The original logger is not changed by creating a scoped one.
    await audit.record({ action: 'a.b', outcome: 'success', entityType: 'x' });
    expect(store.list()[2]?.actorId).toBeUndefined();
  });

  it('TC-13-07 the logger store writes one JSON line flagged audit:true', async () => {
    const log = captureLogger();
    const audit = createAuditLogger({
      store: new LoggerAuditStore(log.logger),
      logger: log.logger,
      now: fixedNow,
    });
    await audit.record(valid);
    const [line] = log.records();
    expect(line).toMatchObject({
      audit: true,
      action: 'employee.deactivate',
      actorId: 'u-1',
      level: 'info',
    });
  });

  it('passes the open transaction through to the store, so the audit entry can commit with the data change', async () => {
    const { audit, store } = setup();
    const tx = { id: 'open-transaction' };
    await audit.record(valid, { transaction: tx });
    await audit
      .withContext({ actorId: 'u-3' })
      .tryRecord({ ...valid, action: 'a.b' }, { transaction: tx });
    await audit.record(valid);
    expect(store.transactions).toEqual([tx, tx, undefined]);
  });

  it('a store that is just an object with append() works (what the SQL store will be)', async () => {
    const received: string[] = [];
    const store: AuditStore = { append: async (entry) => void received.push(entry.action) };
    const audit = createAuditLogger({ store, logger: captureLogger().logger });
    await audit.record(valid);
    expect(received).toEqual(['employee.deactivate']);
  });
});
