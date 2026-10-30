import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { AppError } from '../../../http/app-error';
import { tooManyRequests } from '../../../http/errors';
import { CsvColumn } from '../csv';
import { ReportRow } from '../report-definition';

export interface PdfDocumentInput {
  title: string;
  subtitle: string;
  columns: CsvColumn[];
  rows: ReportRow[];
}

/** Turns a report table into a PDF. A fake in tests, the worker-thread pdfmake renderer in production. */
export interface PdfExporter {
  /** `ownerKey` limits one running export per user. */
  render(input: PdfDocumentInput, ownerKey: string): Promise<Buffer>;
}

export interface WorkerPdfExporterOptions {
  /** Exports rendering at the same time across all users. */
  maxConcurrent?: number;
  /** Exports allowed to wait for a free slot before new ones are refused. */
  maxQueued?: number;
  timeoutMs?: number;
  workerPath?: string;
}

type WorkerMessage = { ok: true; pdf: Uint8Array } | { ok: false; message: string };

/**
 * Renders in a worker thread so the layout work (seconds for large tables) never blocks the
 * API event loop. At most `maxConcurrent` run at once, a few more may wait, the rest get 429;
 * a user can have only one export running at a time.
 */
export class WorkerPdfExporter implements PdfExporter {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private readonly timeoutMs: number;
  private readonly workerPath: string;
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly owners = new Set<string>();

  constructor(options: WorkerPdfExporterOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.maxQueued = options.maxQueued ?? 8;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.workerPath = options.workerPath ?? path.join(__dirname, 'pdf-worker.js');
  }

  async render(input: PdfDocumentInput, ownerKey: string): Promise<Buffer> {
    if (this.owners.has(ownerKey)) {
      throw tooManyRequests('You already have a PDF export running. Wait for it to finish.');
    }
    this.owners.add(ownerKey);
    try {
      await this.acquire();
      try {
        return await this.runWorker(input);
      } finally {
        this.release();
      }
    } finally {
      this.owners.delete(ownerKey);
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }
    if (this.waiters.length >= this.maxQueued) {
      throw tooManyRequests('Too many PDF exports are running. Try again in a moment.');
    }
    // The slot is handed over by release(), so `active` stays unchanged.
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.active -= 1;
    }
  }

  private runWorker(input: PdfDocumentInput): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const worker = new Worker(this.workerPath, {
        workerData: input,
        resourceLimits: { maxOldGenerationSizeMb: 512 },
      });
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        action();
      };
      const timer = setTimeout(
        () =>
          finish(() =>
            reject(
              new AppError(503, 'EXPORT_TIMEOUT', 'The PDF took too long. Narrow the filters.'),
            ),
          ),
        this.timeoutMs,
      );
      worker.once('message', (message: WorkerMessage) =>
        finish(() =>
          message.ok
            ? resolve(Buffer.from(message.pdf))
            : reject(new Error(`PDF worker failed: ${message.message}`)),
        ),
      );
      worker.once('error', (error) => finish(() => reject(error)));
      worker.once('exit', (code) =>
        finish(() => reject(new Error(`PDF worker exited unexpectedly (code ${code})`))),
      );
    });
  }
}
