import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgAuditLogRepository } from './audit-log.repository';

/**
 * Real PostgreSQL. The table is append-only, so the rows this test inserts stay in the test
 * database; a unique module name per run keeps them from touching other tests.
 */
describe('PgAuditLogRepository (PostgreSQL)', () => {
  const pool = getPool();
  const repo = new PgAuditLogRepository(getPool);
  const mod = `viewer_${randomUUID().slice(0, 8).replace(/-/g, '')}`;
  let adminUserId = '';
  let adminName = '';

  const insert = (action: string, occurredAt: string, extra: Record<string, unknown> = {}) =>
    pool.query(
      `INSERT INTO audit_logs (id, occurred_at, action, outcome, actor_id, actor_role, entity_type, entity_id, request_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(),
        occurredAt,
        action,
        extra.outcome ?? 'success',
        extra.actorId ?? null,
        'admin',
        extra.entityType ?? `${mod}_entity`,
        extra.entityId ?? 'e1',
        'req-1',
        extra.changes ? JSON.stringify(extra.changes) : null,
        extra.metadata ? JSON.stringify(extra.metadata) : null,
      ],
    );

  beforeAll(async () => {
    const u = await pool.query<{ id: string; name: string }>(
      `SELECT u.id, CONCAT(e.first_name, ' ', e.last_name) AS name
         FROM users u JOIN employees e ON e.id = u.employee_id ORDER BY u.email LIMIT 1`,
    );
    adminUserId = u.rows[0]?.id ?? '';
    adminName = u.rows[0]?.name ?? '';
    await insert(`${mod}.create`, '2026-10-01T10:00:00Z', { actorId: adminUserId, entityId: 'a' });
    await insert(`${mod}.update`, '2026-10-02T10:00:00Z', { entityId: 'b', changes: { field: 1 } });
    await insert(`${mod}.update`, '2026-10-02T10:00:00Z', { entityId: 'c', outcome: 'failure' });
    await insert(`${mod}.update`, '2026-10-03T10:00:00Z', { entityId: 'd' });
    // `${mod}x.update` must not match the module filter `${mod}` (the dot is part of the prefix).
    await insert(`${mod}x.update`, '2026-10-04T10:00:00Z', { entityId: 'e' });
    // Differs only where the module name has an underscore: it must not match (LIKE wildcard).
    await insert(`${mod.replace('_', 'X')}.update`, '2026-10-05T10:00:00Z', { entityId: 'f' });
    // Six entries at one instant, in their own module: the order among them must come from the id.
    for (let i = 0; i < 6; i++) {
      await insert(`${mod}t.tie`, '2026-10-06T10:00:00Z', { entityId: `t${i}` });
    }
  });

  afterAll(async () => {
    await closePool();
  });

  const find = (
    filters: Record<string, unknown> = {},
    sortOrder: 'asc' | 'desc' = 'desc',
    limit = 50,
    offset = 0,
  ) => repo.findMany({ module: mod, ...filters, sortOrder, limit, offset });

  it('filters by module prefix, newest first, with the actor name from the employee', async () => {
    const { items, total } = await find();
    expect(total).toBe(4);
    expect(items.map((i) => i.entityId)).toEqual([
      'd',
      expect.any(String),
      expect.any(String),
      'a',
    ]);
    const withActor = items.find((i) => i.entityId === 'a');
    expect(withActor?.actor).toEqual({
      id: adminUserId,
      name: adminName.trim() || null,
      role: 'admin',
    });
    expect(items.find((i) => i.entityId === 'd')?.actor).toBeNull();
  });

  it('does not treat the underscore in a module name as a wildcard, nor match a longer name', async () => {
    const ids = (await find()).items.map((i) => i.entityId);
    expect(ids).not.toContain('f');
    expect(ids).not.toContain('e');
    expect(
      (await repo.findMany({ module: 'viewer', sortOrder: 'desc', limit: 10, offset: 0 })).total,
    ).toBe(0);
  });

  it('filters by exact action, outcome, actor, entity and a half-open date range', async () => {
    expect((await find({ action: `${mod}.update` })).total).toBe(3);
    expect((await find({ outcome: 'failure' })).items.map((i) => i.entityId)).toEqual(['c']);
    expect((await find({ actorId: adminUserId })).items.map((i) => i.entityId)).toEqual(['a']);
    expect((await find({ entityType: `${mod}_entity`, entityId: 'b' })).total).toBe(1);
    const range = await find({ from: '2026-10-02T10:00:00Z', to: '2026-10-03T10:00:00Z' }, 'asc');
    expect(range.total).toBe(2); // both 10-02 entries; 10-03 is excluded by the exclusive end
  });

  it('orders entries that share a timestamp by id, in both directions, across pages', async () => {
    const all = async (sortOrder: 'asc' | 'desc') => {
      const ids: string[] = [];
      for (const offset of [0, 2, 4]) {
        const page = await repo.findMany({ module: `${mod}t`, sortOrder, limit: 2, offset });
        ids.push(...page.items.map((i) => i.id));
      }
      return ids;
    };
    const asc = await all('asc');
    expect(asc).toHaveLength(6);
    expect(asc).toEqual([...asc].sort());
    const desc = await all('desc');
    expect(desc).toEqual([...desc].sort().reverse());
    expect(new Set([...asc, ...desc]).size).toBe(6);
  });

  it('returns changes and metadata as stored objects', async () => {
    expect((await find({ entityId: 'b' })).items[0]?.changes).toEqual({ field: 1 });
  });

  it('the database refuses to change or delete an entry (append only)', async () => {
    await expect(
      pool.query(`UPDATE audit_logs SET action = 'x.y' WHERE action LIKE $1`, [`${mod}.%`]),
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`DELETE FROM audit_logs WHERE action LIKE $1`, [`${mod}.%`]),
    ).rejects.toThrow(/append-only/);
  });
});
