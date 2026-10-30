import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import pdfmake from 'pdfmake';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkerPdfExporter } from './pdf-exporter';
import { configure, renderPdf } from './pdf-worker.js';

const columns = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
];
const input = (rows: Array<Record<string, string>>) => ({
  title: 'Headcount',
  subtitle: '2026-10-30 · rows',
  columns,
  rows,
});
const pages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
const fixture = path.join(__dirname, 'slow-worker.fixture.js');

describe('PDF rendering (real pdfmake in a worker thread)', () => {
  const exporter = new WorkerPdfExporter();

  it('produces a PDF for a Latin table without embedding the Tamil font', async () => {
    const pdf = await exporter.render(input([{ code: 'E1', name: 'Arun Kumar' }]), 'u1');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('Tamil');
  }, 30_000);

  it('uses the Tamil font for Tamil text, also inside mixed Latin and Tamil cells', async () => {
    const pdf = await exporter.render(
      input([
        { code: 'E1', name: 'அருண் குமார்' },
        { code: 'E2', name: 'Arun (அருண்) Kumar' },
      ]),
      'u1',
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('Tamil');
  }, 30_000);

  it('repeats the layout over several pages for long tables', async () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ code: `E${i}`, name: `Person ${i}` }));
    expect(pages(await exporter.render(input(rows), 'u1'))).toBeGreaterThan(3);
  }, 30_000);

  it('renders null, dates, numbers and very long text without failing', async () => {
    const pdf = await renderPdf({
      title: 'T',
      subtitle: 'S',
      columns: [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
      ],
      rows: [{ a: null, b: new Date('2026-10-30T00:00:00Z'), c: 'x'.repeat(5000) }],
    });
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe('%PDF-');
  }, 30_000);
});

describe('PDF generator access policy (ADR D-08)', () => {
  // A valid 1x1 PNG. Served over HTTP and from disk, it renders fine unless the policy blocks it.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  let server: http.Server;
  let url = '';
  let file = '';
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits += 1;
      res.setHeader('Content-Type', 'image/png');
      res.end(PNG);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/x.png`;
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-policy-')), 'x.png');
    fs.writeFileSync(file, PNG);
    configure();
  });

  afterAll(() => {
    server.close();
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  const render = (content: unknown[], images?: Record<string, unknown>) =>
    pdfmake.createPdf({ images, content, defaultStyle: { font: 'Inter' } } as never).getBuffer();

  it('the same image renders when it is embedded as data (so the tests below prove the policy)', async () => {
    const dataUri = `data:image/png;base64,${PNG.toString('base64')}`;
    await expect(render([{ image: dataUri }])).resolves.toBeTruthy();
  }, 30_000);

  it('refuses to fetch a URL, without ever contacting the server', async () => {
    // pdfmake downloads remote images only when they are declared in the `images` dictionary.
    await expect(render([{ image: 'remote' }], { remote: { url } })).rejects.toThrow(/denied/);
    expect(hits).toBe(0);
  }, 30_000);

  it('refuses to read a local file outside the bundled fonts', async () => {
    await expect(render([{ image: file }])).rejects.toThrow();
  }, 30_000);

  it('still loads the bundled fonts', async () => {
    await expect(render([{ text: 'fonts still load' }])).resolves.toBeTruthy();
  }, 30_000);
});

describe('WorkerPdfExporter limits', () => {
  const exporter = (options: ConstructorParameters<typeof WorkerPdfExporter>[0] = {}) =>
    new WorkerPdfExporter({ workerPath: fixture, ...options });
  const job = (mode: string, delayMs: number) =>
    ({ ...input([]), mode, delayMs }) as ReturnType<typeof input>;

  it('allows one running export per user (429)', async () => {
    const e = exporter();
    const first = e.render(job('ok', 150), 'u1');
    await expect(e.render(job('ok', 0), 'u1')).rejects.toMatchObject({ statusCode: 429 });
    await expect(first).resolves.toBeInstanceOf(Buffer);
    await expect(e.render(job('ok', 0), 'u1')).resolves.toBeInstanceOf(Buffer);
  });

  it('runs at most maxConcurrent at once, queues a few and refuses the rest (429)', async () => {
    const e = exporter({ maxConcurrent: 1, maxQueued: 1 });
    const running = e.render(job('ok', 200), 'a');
    const queued = e.render(job('ok', 0), 'b');
    await expect(e.render(job('ok', 0), 'c')).rejects.toMatchObject({ statusCode: 429 });
    await expect(Promise.all([running, queued])).resolves.toHaveLength(2);
  });

  it('gives up after the timeout (503) and frees the slot', async () => {
    const e = exporter({ timeoutMs: 100, maxConcurrent: 1 });
    await expect(e.render(job('ok', 5000), 'a')).rejects.toMatchObject({
      statusCode: 503,
      code: 'EXPORT_TIMEOUT',
    });
    await expect(e.render(job('ok', 0), 'a')).resolves.toBeInstanceOf(Buffer);
  });

  it('turns a worker failure or crash into an error and frees the slot', async () => {
    const e = exporter({ maxConcurrent: 1 });
    await expect(e.render(job('fail', 0), 'a')).rejects.toThrow(/layout failed/);
    await expect(e.render(job('crash', 0), 'a')).rejects.toThrow();
    await expect(e.render(job('ok', 0), 'a')).resolves.toBeInstanceOf(Buffer);
  });
});
