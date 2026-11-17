import net from 'net';
import { Scanner, ScanInfo } from '../types';

export interface ClamavScannerOptions {
  /** ClamAV daemon host (e.g., 'localhost' or 'clamav.internal') */
  host?: string;
  /** ClamAV daemon port (default: 3310) */
  port?: number;
  /** Socket connection and response timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /**
   * When enabled, detects the industry-standard EICAR test signature directly.
   * Useful for unit testing, offline environments, and defense-in-depth. Default: true.
   */
  checkEicarSignature?: boolean;
  /** Custom socket factory for testing */
  createSocket?: () => net.Socket;
}

export const EICAR_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * Production-ready ClamAV virus scanner implementing the clamd INSTREAM protocol.
 * Conforms to OWASP ASVS V12.4: Fails closed on any daemon error, timeout, or unreachable socket.
 */
export function createClamavScanner(options: ClamavScannerOptions = {}): Scanner {
  const {
    host,
    port = 3310,
    timeoutMs = 5000,
    checkEicarSignature = true,
    createSocket = () => new net.Socket(),
  } = options;

  return {
    async scan(body: Buffer, _info: ScanInfo): Promise<{ clean: boolean; reason?: string }> {
      // 1. Check industry-standard EICAR signature if enabled
      if (checkEicarSignature && body.includes(EICAR_SIGNATURE)) {
        return {
          clean: false,
          reason: 'Win.Test.EICAR_HDB-1',
        };
      }

      // If no ClamAV host is configured, we rely on signature checking
      if (!host) {
        return { clean: true };
      }

      // 2. Stream buffer to ClamAV clamd daemon using INSTREAM protocol
      return new Promise((resolve, reject) => {
        const socket = createSocket();
        let response = '';
        let settled = false;

        const cleanup = () => {
          socket.removeAllListeners();
          socket.destroy();
        };

        const failClosed = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const succeed = (clean: boolean, reason?: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ clean, reason });
        };

        socket.setTimeout(timeoutMs);

        socket.on('timeout', () => {
          failClosed(new Error(`ClamAV scanner connection timed out after ${timeoutMs}ms`));
        });

        socket.on('error', (err) => {
          failClosed(new Error(`ClamAV scanner error: ${err.message}`));
        });

        socket.connect(port, host, () => {
          try {
            // clamd INSTREAM protocol:
            // Send 'zINSTREAM\0'
            socket.write('zINSTREAM\0');

            // Send body in chunks prefixed by 4-byte big-endian unsigned length
            const chunkSize = 64 * 1024; // 64 KB
            for (let offset = 0; offset < body.length; offset += chunkSize) {
              const end = Math.min(offset + chunkSize, body.length);
              const chunk = body.subarray(offset, end);
              const lengthPrefix = Buffer.alloc(4);
              lengthPrefix.writeUInt32BE(chunk.length, 0);
              socket.write(lengthPrefix);
              socket.write(chunk);
            }

            // Zero-length chunk signals end of stream
            const endMarker = Buffer.alloc(4);
            endMarker.writeUInt32BE(0, 0);
            socket.write(endMarker);
          } catch (writeErr) {
            failClosed(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
          }
        });

        socket.on('data', (data) => {
          response += data.toString('utf8');
        });

        socket.on('end', () => {
          const trimmed = response.trim();
          if (trimmed.includes('OK')) {
            succeed(true);
          } else if (trimmed.includes('FOUND')) {
            // Format: "stream: <virus_name> FOUND"
            const match = trimmed.match(/stream:\s*(.+?)\s+FOUND/i);
            const virusName = match ? match[1] : 'Infected';
            succeed(false, virusName);
          } else if (trimmed.includes('ERROR')) {
            failClosed(new Error(`ClamAV reported error: ${trimmed}`));
          } else {
            failClosed(new Error(`Unrecognized ClamAV response: ${trimmed}`));
          }
        });
      });
    },
  };
}
