import { EventEmitter } from 'events';
import net from 'net';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../http/app-error';
import { Logger } from '../../../logging/logger';
import { SignedLinkService } from '../signed-links';
import { InMemoryStorageAdapter } from './memory-storage-adapter';
import { createStorageService } from '../storage-service';
import { createClamavScanner, EICAR_SIGNATURE } from './clamav-scanner';

class MockSocket extends EventEmitter {
  written: Buffer[] = [];
  destroyed = false;
  timeout = 0;

  setTimeout(ms: number) {
    this.timeout = ms;
  }

  connect(_port: number, _host: string, cb?: () => void) {
    if (cb) process.nextTick(cb);
    return this;
  }

  write(chunk: unknown) {
    this.written.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return true;
  }

  destroy() {
    this.destroyed = true;
    return this;
  }

  simulateData(data: string) {
    this.emit('data', Buffer.from(data));
  }

  simulateEnd() {
    this.emit('end');
  }

  simulateError(err: Error) {
    this.emit('error', err);
  }

  simulateTimeout() {
    this.emit('timeout');
  }
}

describe('ClamAV Scanner Adapter (ASVS V12.4)', () => {
  it('returns clean: true for safe content in signature check mode', async () => {
    const scanner = createClamavScanner({ checkEicarSignature: true });
    const result = await scanner.scan(Buffer.from('Hello, world! Safe document.'), {
      contentType: 'text/plain',
      size: 28,
      originalName: 'test.txt',
    });

    expect(result.clean).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('detects EICAR test signature and returns clean: false with reason', async () => {
    const scanner = createClamavScanner({ checkEicarSignature: true });
    const infectedBody = Buffer.from(`Prefix data ${EICAR_SIGNATURE} Suffix data`);
    const result = await scanner.scan(infectedBody, {
      contentType: 'application/octet-stream',
      size: infectedBody.length,
      originalName: 'eicar.com',
    });

    expect(result.clean).toBe(false);
    expect(result.reason).toBe('Win.Test.EICAR_HDB-1');
  });

  it('communicates with clamd via INSTREAM protocol and detects clean stream', async () => {
    const mockSocket = new MockSocket();
    const createSocket = () => {
      setImmediate(() => {
        mockSocket.simulateData('stream: OK\0');
        mockSocket.simulateEnd();
      });
      return mockSocket as unknown as net.Socket;
    };

    const scanner = createClamavScanner({
      host: 'localhost',
      port: 3310,
      createSocket,
    });

    const body = Buffer.from('Valid clean file content');
    const result = await scanner.scan(body, {
      contentType: 'text/plain',
      size: body.length,
      originalName: 'report.txt',
    });

    expect(result.clean).toBe(true);
    expect(mockSocket.written[0]?.toString('utf8')).toBe('zINSTREAM\0');
  });

  it('detects malware from clamd stream response and returns clean: false', async () => {
    const mockSocket = new MockSocket();
    const createSocket = () => {
      setImmediate(() => {
        mockSocket.simulateData('stream: Trojan.Generic.12345 FOUND\0');
        mockSocket.simulateEnd();
      });
      return mockSocket as unknown as net.Socket;
    };

    const scanner = createClamavScanner({
      host: 'localhost',
      port: 3310,
      createSocket,
      checkEicarSignature: false,
    });

    const body = Buffer.from('Malicious payload');
    const result = await scanner.scan(body, {
      contentType: 'application/octet-stream',
      size: body.length,
      originalName: 'payload.bin',
    });

    expect(result.clean).toBe(false);
    expect(result.reason).toBe('Trojan.Generic.12345');
  });

  it('fails closed when clamd returns ERROR', async () => {
    const mockSocket = new MockSocket();
    const createSocket = () => {
      setImmediate(() => {
        mockSocket.simulateData('stream: Scan error ERROR\0');
        mockSocket.simulateEnd();
      });
      return mockSocket as unknown as net.Socket;
    };

    const scanner = createClamavScanner({
      host: 'localhost',
      port: 3310,
      createSocket,
    });

    await expect(
      scanner.scan(Buffer.from('Some data'), {
        contentType: 'text/plain',
        size: 9,
        originalName: 'doc.txt',
      }),
    ).rejects.toThrow(/ClamAV reported error/);
  });

  it('fails closed when socket connection encounters an error', async () => {
    const mockSocket = new MockSocket();
    const createSocket = () => {
      setImmediate(() => {
        mockSocket.simulateError(new Error('ECONNREFUSED'));
      });
      return mockSocket as unknown as net.Socket;
    };

    const scanner = createClamavScanner({
      host: 'localhost',
      port: 3310,
      createSocket,
    });

    await expect(
      scanner.scan(Buffer.from('Some data'), {
        contentType: 'text/plain',
        size: 9,
        originalName: 'doc.txt',
      }),
    ).rejects.toThrow(/ClamAV scanner error: ECONNREFUSED/);
  });

  it('fails closed when socket connection times out', async () => {
    const mockSocket = new MockSocket();
    const createSocket = () => {
      setImmediate(() => {
        mockSocket.simulateTimeout();
      });
      return mockSocket as unknown as net.Socket;
    };

    const scanner = createClamavScanner({
      host: 'localhost',
      port: 3310,
      timeoutMs: 100,
      createSocket,
    });

    await expect(
      scanner.scan(Buffer.from('Some data'), {
        contentType: 'text/plain',
        size: 9,
        originalName: 'doc.txt',
      }),
    ).rejects.toThrow(/timed out/);
  });

  describe('StorageService Integration with ClamavScanner', () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;

    const mockSigner = {
      sign: vi.fn().mockReturnValue({ url: '/test', token: 'tok', expiresAt: '2026-12-31' }),
      verify: vi.fn(),
    } as unknown as SignedLinkService;

    it('rejects infected file upload with 422 Unprocessable and logs warning', async () => {
      const scanner = createClamavScanner({ checkEicarSignature: true });
      const storage = createStorageService({
        adapter: new InMemoryStorageAdapter(),
        signer: mockSigner,
        logger: mockLogger,
        maxFileBytes: 10 * 1024 * 1024,
        scanner,
      });

      // PDF with EICAR string
      const fakePdf = Buffer.concat([
        Buffer.from('%PDF-1.4 sample content\n'),
        Buffer.from(EICAR_SIGNATURE),
        Buffer.from('\n%%EOF'),
      ]);

      await expect(
        storage.upload({
          category: 'receipts',
          filename: 'invoice.pdf',
          declaredType: 'application/pdf',
          body: fakePdf,
          uploadedBy: 'usr-attacker',
        }),
      ).rejects.toThrow(AppError);

      try {
        await storage.upload({
          category: 'receipts',
          filename: 'invoice.pdf',
          declaredType: 'application/pdf',
          body: fakePdf,
          uploadedBy: 'usr-attacker',
        });
      } catch (error: unknown) {
        const err = error as AppError;
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('UNPROCESSABLE_ENTITY');
        expect(err.message).toContain('virus scan');
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'upload rejected by scanner',
        expect.objectContaining({
          category: 'receipts',
          uploadedBy: 'usr-attacker',
        }),
      );
    });

    it('fails closed with 503 SERVICE_UNAVAILABLE when scanner throws error', async () => {
      const failingScanner = {
        scan: vi.fn().mockRejectedValue(new Error('Scanner daemon crashed')),
      };

      const storage = createStorageService({
        adapter: new InMemoryStorageAdapter(),
        signer: mockSigner,
        logger: mockLogger,
        maxFileBytes: 10 * 1024 * 1024,
        scanner: failingScanner,
      });

      const cleanPdf = Buffer.from('%PDF-1.4 valid pdf content\n%%EOF');

      try {
        await storage.upload({
          category: 'receipts',
          filename: 'valid.pdf',
          declaredType: 'application/pdf',
          body: cleanPdf,
          uploadedBy: 'usr-employee',
        });
        expect.unreachable('Should have thrown 503');
      } catch (error: unknown) {
        const err = error as AppError;
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe('SERVICE_UNAVAILABLE');
        expect(err.message).toContain('please try again later');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'virus scan failed',
        expect.objectContaining({ category: 'receipts' }),
      );
    });
  });
});
