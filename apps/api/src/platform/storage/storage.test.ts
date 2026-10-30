import { createHash, createHmac } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { captureLogger } from '../../test/helpers';
import { exe, html, jpeg, pdf, png } from '../../test/fixtures';
import { describeStorageContract } from '../contracts/storage.contract';
import { LocalDiskStorageAdapter } from './adapters/local-disk-storage-adapter';
import { InMemoryStorageAdapter } from './adapters/memory-storage-adapter';
import { contentDisposition, extensionOf, sanitizeFilename } from './filename';
import { createSignedLinkService } from './signed-links';
import { createStorageService } from './storage-service';
import { Scanner } from './types';
import { checkUpload, sniffKind, UPLOAD_POLICIES } from './upload-policy';

const SECRET = 'unit-test-secret-unit-test-secret-1234';
const T0 = Date.parse('2026-10-29T10:00:00.000Z');

function setup(options: { scanner?: Scanner; maxFileBytes?: number; requireScan?: boolean } = {}) {
  const adapter = new InMemoryStorageAdapter();
  const log = captureLogger();
  let clock = T0;
  let counter = 0;
  const now = () => new Date(clock);
  const signer = createSignedLinkService({ secret: SECRET, now });
  const storage = createStorageService({
    adapter,
    signer,
    logger: log.logger,
    maxFileBytes: options.maxFileBytes ?? 10 * 1024 * 1024,
    scanner: options.scanner,
    requireScan: options.requireScan,
    now,
    newId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  });
  return { adapter, storage, signer, log, advance: (ms: number) => (clock += ms) };
}

const upload = {
  category: 'employeeDocuments' as const,
  filename: 'contract.pdf',
  declaredType: 'application/pdf',
  uploadedBy: 'u-1',
};

// ---- TC-13-32 / TC-13-33: adapters pass the same contract ---------------------------------------
describeStorageContract('in-memory', async () => ({ adapter: new InMemoryStorageAdapter() }));
describeStorageContract('local disk', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maxr-storage-'));
  return {
    adapter: new LocalDiskStorageAdapter(dir),
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
});

describe('local disk adapter (TC-13-33)', () => {
  it('writes only inside its root, with private permissions, and leaves no temp files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maxr-storage-'));
    try {
      const adapter = new LocalDiskStorageAdapter(dir);
      await adapter.put('receipts/2026/10/abc', Buffer.from('x'), {
        contentType: 'application/pdf',
        size: 1,
        sha256: 'a'.repeat(64),
        originalName: 'a.pdf',
        uploadedBy: 'u',
        createdAt: 'now',
      });
      const files = (await fs.readdir(path.join(dir, 'receipts/2026/10'))).sort();
      expect(files).toEqual(['abc.bin', 'abc.meta.json']);
      const mode = (await fs.stat(path.join(dir, 'receipts/2026/10/abc.bin'))).mode & 0o777;
      expect(mode).toBe(0o600);
      // Nothing was created next to the root (no traversal).
      expect((await fs.readdir(path.dirname(dir))).filter((n) => n.startsWith('outside'))).toEqual(
        [],
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('type detection (TC-13-21)', () => {
  it('recognises pdf, png and jpeg by their first bytes and nothing else', () => {
    expect(sniffKind(pdf())).toBe('pdf');
    expect(sniffKind(png())).toBe('png');
    expect(sniffKind(jpeg())).toBe('jpeg');
    expect(sniffKind(exe())).toBeNull();
    expect(sniffKind(html())).toBeNull();
    expect(sniffKind(Buffer.alloc(0))).toBeNull();
    expect(sniffKind(Buffer.from('%PD'))).toBeNull(); // shorter than the signature
  });
});

describe('upload (TC-13-20 .. TC-13-22)', () => {
  it('TC-13-20 stores under a server-generated key and returns size, sha256 and the detected type', async () => {
    const { storage, adapter } = setup();
    const body = pdf('hello');
    const result = await storage.upload({ ...upload, body });
    expect(result.key).toBe('employee-documents/2026/10/00000000-0000-4000-8000-000000000001');
    expect(result).toMatchObject({
      size: body.length,
      contentType: 'application/pdf',
      sha256: createHash('sha256').update(body).digest('hex'),
      originalName: 'contract.pdf',
    });
    const stored = await adapter.get(result.key);
    expect(stored?.body.equals(body)).toBe(true);
    expect(stored?.meta).toMatchObject({
      uploadedBy: 'u-1',
      contentType: 'application/pdf',
      createdAt: '2026-10-29T10:00:00.000Z',
    });
  });

  it('TC-13-20 the key never contains anything the client sent', async () => {
    const { storage } = setup();
    const result = await storage.upload({
      ...upload,
      filename: '../../etc/passwd/../../secret.pdf',
      body: pdf(),
    });
    expect(result.key).not.toMatch(/secret|passwd|\.\./);
    expect(result.originalName).toBe('secret.pdf');
  });

  it('TC-13-20 uses the right prefix for each category', async () => {
    const { storage } = setup();
    expect((await storage.upload({ ...upload, category: 'receipts', body: pdf() })).key).toMatch(
      /^receipts\//,
    );
    expect(
      (
        await storage.upload({
          ...upload,
          category: 'profilePhotos',
          filename: 'me.png',
          declaredType: 'image/png',
          body: png(),
        })
      ).key,
    ).toMatch(/^profile-photos\//);
  });

  it('TC-13-20 accepts a declared type with parameters and an upper-case extension', async () => {
    const { storage } = setup();
    await expect(
      storage.upload({
        ...upload,
        filename: 'SCAN.JPG',
        declaredType: 'IMAGE/JPEG; charset=binary',
        body: jpeg(),
      }),
    ).resolves.toMatchObject({ contentType: 'image/jpeg' });
  });

  it.each([
    ['an empty file', { body: Buffer.alloc(0) }, 400],
    ['a program renamed to .pdf', { body: exe() }, 400],
    ['html renamed to .pdf', { body: html() }, 400],
    ['a PDF declared as image/png', { declaredType: 'image/png' }, 400],
    ['a PDF named .png', { filename: 'invoice.png' }, 400],
    ['a PDF with no extension', { filename: 'invoice' }, 400],
    ['a PDF with a double extension trick', { filename: 'invoice.pdf.exe' }, 400],
    ['a PDF declared as octet-stream', { declaredType: 'application/octet-stream' }, 400],
  ])('TC-13-21 rejects %s and stores nothing', async (_label, patch, status) => {
    const { storage, adapter } = setup();
    await expect(storage.upload({ ...upload, body: pdf(), ...patch })).rejects.toMatchObject({
      statusCode: status,
    });
    expect(adapter.size).toBe(0);
  });

  it('TC-13-21 enforces the category policy: no PDF as a profile photo', async () => {
    const { storage, adapter } = setup();
    await expect(
      storage.upload({ ...upload, category: 'profilePhotos', body: pdf() }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(adapter.size).toBe(0);
  });

  it('TC-13-21 enforces the size limit of the category (413)', async () => {
    const { storage, adapter } = setup();
    const tooBig = Buffer.concat([pdf(), Buffer.alloc(UPLOAD_POLICIES.receipts.maxBytes)]);
    await expect(
      storage.upload({ ...upload, category: 'receipts', body: tooBig }),
    ).rejects.toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(adapter.size).toBe(0);
  });

  it('TC-13-21 enforces the global limit from the configuration, even below the category limit', async () => {
    const { storage } = setup({ maxFileBytes: 1000 });
    await expect(storage.upload({ ...upload, body: pdf('x'.repeat(2000)) })).rejects.toMatchObject({
      statusCode: 413,
    });
    await expect(storage.upload({ ...upload, body: pdf('x'.repeat(100)) })).resolves.toBeTruthy();
  });

  it('TC-13-21 error messages do not echo the file name or content', async () => {
    const { storage } = setup();
    const error = await storage
      .upload({ ...upload, filename: 'maya-salary-secret.exe', body: exe() })
      .catch((e: Error) => e);
    expect(JSON.stringify(error)).not.toMatch(/maya|salary|secret/);
  });

  it('TC-13-22 logs the key and size, never the file name', async () => {
    const { storage, log } = setup();
    await storage.upload({ ...upload, filename: 'maya-private-contract.pdf', body: pdf() });
    const text = log.lines.join('\n');
    expect(text).toContain('file stored');
    expect(text).not.toMatch(/maya|private-contract/);
  });
});

describe('policy check on its own', () => {
  it('only allows what the policy lists', () => {
    expect(() =>
      checkUpload(UPLOAD_POLICIES.profilePhotos, {
        filename: 'a.pdf',
        declaredType: 'application/pdf',
        body: pdf(),
      }),
    ).toThrow();
    expect(
      checkUpload(UPLOAD_POLICIES.profilePhotos, {
        filename: 'a.png',
        declaredType: 'image/png',
        body: png(),
      }).kind,
    ).toBe('png');
  });
});

describe('filenames (TC-13-23)', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\Asha\\evil.pdf', 'evil.pdf'],
    ['/var/www/shell.php', 'shell.php'],
    ['a\u0000b\u001fc.pdf', 'abc.pdf'],
    ['<script>x</script>.pdf', 'script_.pdf'],
    ['<img src=x onerror=alert(1)>.pdf', '_img src=x onerror=alert(1)_.pdf'],
    ['con"tract?.pdf', 'con_tract_.pdf'],
    ['   ', 'file'],
    ['....', 'file'],
    ['.hidden.pdf', 'hidden.pdf'],
    ['Résumé 2026.pdf', 'Résumé 2026.pdf'],
    ['a    b.pdf', 'a b.pdf'],
  ])('sanitises %j to %j', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });

  it('keeps a very long name within 120 characters and keeps its extension', () => {
    const name = sanitizeFilename(`${'a'.repeat(500)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith('.pdf')).toBe(true);
  });

  it('extensionOf', () => {
    expect(extensionOf('a.PDF')).toBe('pdf');
    expect(extensionOf('a.tar.gz')).toBe('gz');
    expect(extensionOf('noext')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('trailingdot.')).toBe('');
  });

  it('Content-Disposition is an attachment and cannot be used to inject headers', () => {
    const header = contentDisposition('a"b\r\nSet-Cookie: session=1.pdf');
    expect(header.startsWith('attachment; ')).toBe(true);
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/filename="([^"]*)"/)?.[1]).not.toContain('"');
    expect(header).toContain("filename*=UTF-8''");
  });

  it('Content-Disposition handles non-ASCII names with an ASCII fallback', () => {
    const header = contentDisposition('Résumé.pdf');
    expect(header).toContain('filename="R_sum_.pdf"');
    expect(header).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9.pdf");
  });
});

describe('virus scan hook (TC-13-24)', () => {
  it('a clean file is stored and the scanner is told the detected type and size', async () => {
    const scan = vi.fn(async () => ({ clean: true }));
    const { storage, adapter } = setup({ scanner: { scan } });
    const body = pdf();
    await storage.upload({ ...upload, body });
    expect(scan).toHaveBeenCalledWith(body, {
      contentType: 'application/pdf',
      size: body.length,
      originalName: 'contract.pdf',
    });
    expect(adapter.size).toBe(1);
  });

  it('an infected file is rejected with 422 and nothing is stored', async () => {
    const { storage, adapter, log } = setup({
      scanner: { scan: async () => ({ clean: false, reason: 'Eicar-Test' }) },
    });
    await expect(storage.upload({ ...upload, body: pdf() })).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(adapter.size).toBe(0);
    expect(log.lines.join('\n')).toContain('upload rejected by scanner');
  });

  it('FAIL CLOSED: if the scanner breaks, the upload is refused (503) and nothing is stored', async () => {
    const { storage, adapter, log } = setup({
      scanner: {
        scan: async () => {
          throw new Error('clamd socket closed');
        },
      },
    });
    const error = await storage.upload({ ...upload, body: pdf() }).catch((e: Error) => e);
    expect(error).toMatchObject({ statusCode: 503 });
    expect((error as Error).message).not.toContain('clamd');
    expect(adapter.size).toBe(0);
    expect(log.lines.join('\n')).toContain('virus scan failed');
  });

  it('a scan is not run for a file that fails the type check (cheap checks first)', async () => {
    const scan = vi.fn(async () => ({ clean: true }));
    const { storage } = setup({ scanner: { scan } });
    await expect(storage.upload({ ...upload, body: exe() })).rejects.toThrow();
    expect(scan).not.toHaveBeenCalled();
  });

  it('the service cannot be created without a scanner when scanning is required', () => {
    expect(() => setup({ requireScan: true })).toThrow(/virus scanner/);
    expect(() =>
      setup({ requireScan: true, scanner: { scan: async () => ({ clean: true }) } }),
    ).not.toThrow();
  });
});

describe('signed links (TC-13-25 .. TC-13-28)', () => {
  const key = 'receipts/2026/10/abc-123';
  const make = (secret = SECRET, clockRef = { ms: T0 }) => ({
    clockRef,
    signer: createSignedLinkService({ secret, now: () => new Date(clockRef.ms) }),
  });
  /** Builds a token with a VALID signature around any payload, to test what comes after the signature check. */
  const forge = (payload: unknown, secret = SECRET) => {
    const body = Buffer.from(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    ).toString('base64url');
    return `${body}.${createHmac('sha256', secret).update(body).digest().toString('base64url')}`;
  };

  it('TC-13-25 a fresh link verifies and carries the key, subject and expiry', () => {
    const { signer } = make();
    const { token, expiresAt } = signer.sign({ key, subject: 'u-1' });
    expect(expiresAt.toISOString()).toBe('2026-10-29T10:05:00.000Z'); // default 300 s
    expect(signer.verify(token, { subject: 'u-1' })).toEqual({
      ok: true,
      key,
      subject: 'u-1',
      expiresAt,
    });
  });

  it('TC-13-25 the lifetime can be chosen up to 900 seconds', () => {
    const { signer } = make();
    expect(signer.sign({ key, subject: 'u', ttlSeconds: 900 }).expiresAt.toISOString()).toBe(
      '2026-10-29T10:15:00.000Z',
    );
  });

  it('TC-13-26 an expired link is refused (and exactly at the expiry second too)', () => {
    const { signer, clockRef } = make();
    const { token } = signer.sign({ key, subject: 'u-1', ttlSeconds: 60 });
    clockRef.ms = T0 + 59_000;
    expect(signer.verify(token, { subject: 'u-1' }).ok).toBe(true);
    clockRef.ms = T0 + 60_000;
    expect(signer.verify(token, { subject: 'u-1' })).toEqual({ ok: false, reason: 'expired' });
    clockRef.ms = T0 + 3_600_000;
    expect(signer.verify(token, { subject: 'u-1' })).toEqual({ ok: false, reason: 'expired' });
  });

  it('TC-13-26 a link issued to one user is useless to another, or to nobody', () => {
    const { signer } = make();
    const { token } = signer.sign({ key, subject: 'u-1' });
    expect(signer.verify(token, { subject: 'u-2' })).toEqual({ ok: false, reason: 'subject' });
    expect(signer.verify(token, {})).toEqual({ ok: false, reason: 'subject' });
    expect(signer.verify(token)).toEqual({ ok: false, reason: 'subject' });
  });

  it('TC-13-27 changing the payload (pointing the link at another file) breaks the signature', () => {
    const { signer } = make();
    const { token } = signer.sign({ key, subject: 'u-1' });
    const [, signature] = token.split('.');
    const evilPayload = Buffer.from(
      JSON.stringify({
        k: 'employee-documents/2026/10/other',
        e: Math.floor(T0 / 1000) + 3600,
        s: 'u-1',
      }),
    ).toString('base64url');
    expect(signer.verify(`${evilPayload}.${signature}`, { subject: 'u-1' })).toEqual({
      ok: false,
      reason: 'signature',
    });
  });

  it('TC-13-27 a changed signature, or one made with another secret, is refused', () => {
    const { signer } = make();
    const { token } = signer.sign({ key, subject: 'u-1' });
    const [payload, signature] = token.split('.') as [string, string];
    const flipped = `${signature.slice(0, -2)}${signature.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(signer.verify(`${payload}.${flipped}`, { subject: 'u-1' })).toEqual({
      ok: false,
      reason: 'signature',
    });
    expect(
      signer.verify(
        forge(
          { k: key, e: Math.floor(T0 / 1000) + 600, s: 'u-1' },
          'another-secret-another-secret-123456',
        ),
        { subject: 'u-1' },
      ),
    ).toEqual({ ok: false, reason: 'signature' });
  });

  it('TC-13-27 a token signed with a different secret never verifies (secret rotation)', () => {
    const a = make('secret-A-secret-A-secret-A-secret-A!').signer;
    const b = make('secret-B-secret-B-secret-B-secret-B!').signer;
    expect(b.verify(a.sign({ key, subject: 'u' }).token, { subject: 'u' }).ok).toBe(false);
  });

  it.each([
    '',
    'x',
    'a.b.c',
    '.',
    'a.',
    '.b',
    'no-dot-at-all',
    '🙂.🙂',
    'a'.repeat(3000),
    `${'a'.repeat(1500)}.${'b'.repeat(1500)}`,
  ])('TC-13-27 garbage token %# is refused without throwing', (token) => {
    const result = make().signer.verify(token, { subject: 'u' });
    expect(result.ok).toBe(false);
  });

  it('TC-13-27 non-string input is refused without throwing', () => {
    const { signer } = make();
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(signer.verify(bad as never).ok).toBe(false);
    }
  });

  it('TC-13-27 even a correctly SIGNED payload is refused if its content is wrong', () => {
    const { signer } = make();
    const future = Math.floor(T0 / 1000) + 600;
    expect(signer.verify(forge('not json'), { subject: 'u' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(signer.verify(forge({ k: key }), { subject: 'u' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(
      signer.verify(forge({ k: '../../etc/passwd', e: future, s: 'u' }), { subject: 'u' }),
    ).toEqual({ ok: false, reason: 'malformed' });
    expect(signer.verify(forge({ k: key, e: 'tomorrow', s: 'u' }), { subject: 'u' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(signer.verify(forge({ k: key, e: future, s: 'u', extra: 1 }), { subject: 'u' }).ok).toBe(
      true,
    ); // unknown fields are ignored, not trusted
  });

  it('TC-13-28 the lifetime is capped: more than 900 seconds, zero, negative or fractional are programming errors', () => {
    const { signer } = make();
    for (const ttlSeconds of [901, 3600, 0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => signer.sign({ key, subject: 'u', ttlSeconds })).toThrow(RangeError);
    }
  });

  it('TC-13-28 refuses to sign an invalid key, and refuses a weak secret', () => {
    expect(() => make().signer.sign({ key: '../x', subject: 'u' })).toThrow();
    expect(() => createSignedLinkService({ secret: 'short' })).toThrow(/32/);
  });
});

describe('storage service links and downloads', () => {
  it('createDownloadLink refuses a file that does not exist (no links to nothing)', async () => {
    const { storage } = setup();
    await expect(
      storage.createDownloadLink('receipts/2026/10/missing', { subject: 'u-1' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('createDownloadLink refuses an invalid key', async () => {
    const { storage } = setup();
    await expect(storage.createDownloadLink('../etc/passwd', { subject: 'u-1' })).rejects.toThrow();
  });

  it('a link opens the file for its user only', async () => {
    const { storage } = setup();
    const { key } = await storage.upload({ ...upload, body: pdf('abc') });
    const link = await storage.createDownloadLink(key, { subject: 'u-1' });
    expect(link.url).toBe(`/api/v1/files/download?token=${encodeURIComponent(link.token)}`);
    expect(await storage.openDownload(link.token, { subject: 'u-1' })).toMatchObject({ ok: true });
    expect(await storage.openDownload(link.token, { subject: 'u-2' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('expired is reported as expired, everything else that is not genuine as invalid', async () => {
    const { storage, advance } = setup();
    const { key } = await storage.upload({ ...upload, body: pdf() });
    const { token } = await storage.createDownloadLink(key, { subject: 'u-1', ttlSeconds: 10 });
    advance(11_000);
    expect(await storage.openDownload(token, { subject: 'u-1' })).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(await storage.openDownload('garbage', { subject: 'u-1' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
