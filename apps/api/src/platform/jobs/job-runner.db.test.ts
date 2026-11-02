import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { JobRunner } from './job-runner';

/** Real PostgreSQL: two runners stand for two API instances sharing one database. */
describe('JobRunner against PostgreSQL', () => {
  const logger = createLogger({ level: 'silent', write: () => undefined });
  const instanceA = new JobRunner(getPool, logger, []);
  const instanceB = new JobRunner(getPool, logger, []);
  const name = `test-job-${Date.now()}`;

  afterAll(async () => {
    await closePool();
  });

  it('lets one instance run a job at a time and makes the other skip', async () => {
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const running = new Promise<void>((resolve) => (started = resolve));
    const first = instanceA.runOnce({
      name,
      run: () =>
        new Promise<void>((resolve) => {
          release = resolve;
          started();
        }),
    });
    await running;

    let ranOnB = false;
    const second = await instanceB.runOnce({ name, run: async () => void (ranOnB = true) });
    expect(second).toBe('skipped');
    expect(ranOnB).toBe(false);

    release();
    expect(await first).toBe('ran');
    // The lock is gone with the transaction: now B can run it.
    expect(await instanceB.runOnce({ name, run: async () => void (ranOnB = true) })).toBe('ran');
    expect(ranOnB).toBe(true);
  });

  it('does not block a different job', async () => {
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const running = new Promise<void>((resolve) => (started = resolve));
    const slow = instanceA.runOnce({
      name: `${name}-slow`,
      run: () =>
        new Promise<void>((resolve) => {
          release = resolve;
          started();
        }),
    });
    await running;
    expect(await instanceB.runOnce({ name: `${name}-other`, run: async () => undefined })).toBe(
      'ran',
    );
    release();
    await slow;
  });

  it('releases the lock when a job fails, so the next pass can try again', async () => {
    const failing = `${name}-failing`;
    expect(
      await instanceA.runOnce({
        name: failing,
        run: async () => {
          throw new Error('boom');
        },
      }),
    ).toBe('failed');
    expect(await instanceB.runOnce({ name: failing, run: async () => undefined })).toBe('ran');
  });
});
