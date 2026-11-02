import type { Pool } from 'pg';
import type { Logger } from '../../logging/logger';

export interface Job {
  /** Stable name; it is also the cross-instance lock key. */
  name: string;
  run(now: Date): Promise<void>;
}

export type JobOutcome = 'ran' | 'skipped' | 'failed';

/**
 * Runs background jobs on an interval inside the API process (D-15). With several API instances
 * every one of them ticks, but a PostgreSQL advisory lock held for the length of a run lets only
 * one instance run a given job at a time; the others skip that tick. A failing job is logged and
 * tried again at the next tick, and never stops the runner or the other jobs.
 */
export class JobRunner {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly getPool: () => Pool,
    private readonly logger: Logger,
    private readonly jobs: Job[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // A pending tick must not keep the process alive on shutdown.
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One pass over every job. Passes do not overlap inside one process. */
  async tick(): Promise<JobOutcome[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const outcomes: JobOutcome[] = [];
      for (const job of this.jobs) outcomes.push(await this.runOnce(job));
      return outcomes;
    } finally {
      this.running = false;
    }
  }

  async runOnce(job: Job): Promise<JobOutcome> {
    const client = await this.getPool().connect();
    try {
      // A transaction-level advisory lock is released by the commit or rollback below, even if
      // this process dies half way: the connection closes and the lock goes with it.
      await client.query('BEGIN');
      const lock = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
        [`job:${job.name}`],
      );
      if (!lock.rows[0]?.locked) {
        await client.query('ROLLBACK');
        return 'skipped';
      }
      try {
        await job.run(this.now());
      } catch (err) {
        this.logger.error('background job failed', { job: job.name, err });
        await client.query('ROLLBACK');
        return 'failed';
      }
      await client.query('COMMIT');
      return 'ran';
    } catch (err) {
      this.logger.error('background job could not run', { job: job.name, err });
      await client.query('ROLLBACK').catch(() => undefined);
      return 'failed';
    } finally {
      client.release();
    }
  }
}
