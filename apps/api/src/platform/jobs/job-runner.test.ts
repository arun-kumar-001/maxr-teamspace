import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../logging/logger';
import { Job, JobRunner } from './job-runner';

function fakePool(options: { locked?: boolean } = {}) {
  const sql: string[] = [];
  const client = {
    query: vi.fn(async (text: string) => {
      sql.push(text.trim().split('\n')[0] as string);
      if (text.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ locked: options.locked ?? true }] };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: async () => client } as unknown as Pool, sql, client };
}

const logs: unknown[] = [];
const logger = createLogger({ level: 'error', write: (line) => logs.push(line) });
const NOW = new Date('2026-11-01T00:00:00Z');

afterEach(() => {
  vi.useRealTimers();
  logs.length = 0;
});

describe('JobRunner.runOnce', () => {
  it('runs the job under the lock and commits', async () => {
    const { pool, sql, client } = fakePool();
    const run = vi.fn(async () => undefined);
    const outcome = await new JobRunner(
      () => pool,
      logger,
      [],
      () => NOW,
    ).runOnce({ name: 'a', run });
    expect(outcome).toBe('ran');
    expect(run).toHaveBeenCalledWith(NOW);
    expect(sql).toEqual([
      'BEGIN',
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('skips the job when another instance holds the lock', async () => {
    const { pool, sql, client } = fakePool({ locked: false });
    const run = vi.fn(async () => undefined);
    const outcome = await new JobRunner(() => pool, logger, []).runOnce({ name: 'a', run });
    expect(outcome).toBe('skipped');
    expect(run).not.toHaveBeenCalled();
    expect(sql.at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('logs a failing job, rolls back and reports it, without throwing', async () => {
    const { pool, sql, client } = fakePool();
    const outcome = await new JobRunner(() => pool, logger, []).runOnce({
      name: 'broken',
      run: async () => {
        throw new Error('boom');
      },
    });
    expect(outcome).toBe('failed');
    expect(sql.at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(logs.join('')).toContain('background job failed');
  });

  it('takes a different lock for each job name', async () => {
    const { pool, client } = fakePool();
    const runner = new JobRunner(() => pool, logger, []);
    await runner.runOnce({ name: 'one', run: async () => undefined });
    await runner.runOnce({ name: 'two', run: async () => undefined });
    const keys = client.query.mock.calls
      .filter(([text]) => String(text).includes('pg_try_advisory_xact_lock'))
      .map((call) => (call as unknown as [string, string[]])[1]?.[0]);
    expect(keys).toEqual(['job:one', 'job:two']);
  });
});

describe('JobRunner.tick and timers', () => {
  it('runs every job in order, and one failing job does not stop the next', async () => {
    const { pool } = fakePool();
    const order: string[] = [];
    const jobs: Job[] = [
      { name: 'first', run: async () => void order.push('first') },
      {
        name: 'second',
        run: async () => {
          order.push('second');
          throw new Error('fails');
        },
      },
      { name: 'third', run: async () => void order.push('third') },
    ];
    const outcomes = await new JobRunner(() => pool, logger, jobs).tick();
    expect(outcomes).toEqual(['ran', 'failed', 'ran']);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('does not start a second pass while one is still running', async () => {
    const { pool } = fakePool();
    let release: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const runner = new JobRunner(() => pool, logger, [{ name: 'slow', run }]);
    const first = runner.tick();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(await runner.tick()).toEqual([]);
    release();
    expect(await first).toEqual(['ran']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ticks on the interval and stops when told', async () => {
    vi.useFakeTimers();
    const { pool } = fakePool();
    const run = vi.fn(async () => undefined);
    const runner = new JobRunner(() => pool, logger, [{ name: 'a', run }]);
    runner.start(1000);
    runner.start(1000); // a second start is ignored
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(3);
    runner.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
