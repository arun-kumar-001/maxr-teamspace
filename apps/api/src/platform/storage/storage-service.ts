import { createHash, randomUUID } from 'crypto';
import { AppError } from '../../http/app-error';
import { notFound, unprocessable } from '../../http/errors';
import { Logger } from '../../logging/logger';
import { sanitizeFilename } from './filename';
import { SignedLinkService } from './signed-links';
import { checkUpload, UPLOAD_POLICIES } from './upload-policy';
import {
  DownloadLink,
  Scanner,
  StorageAdapter,
  StoredFile,
  UploadRequest,
  UploadResult,
} from './types';

export type DownloadOutcome =
  { ok: true; file: StoredFile } | { ok: false; reason: 'invalid' | 'expired' | 'not_found' };

export interface StorageService {
  /** Validates, scans and stores a file. The only way files get in. */
  upload(request: UploadRequest): Promise<UploadResult>;
  /**
   * Issues a short-lived download link bound to `subject` (the user id). Call it only AFTER
   * your module has checked that this user may read this file.
   */
  createDownloadLink(
    key: string,
    options: { subject: string; ttlSeconds?: number },
  ): Promise<DownloadLink>;
  /** Used by the download route: verifies the link, then returns the file. */
  openDownload(token: string, options: { subject?: string }): Promise<DownloadOutcome>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

export interface StorageServiceOptions {
  adapter: StorageAdapter;
  signer: SignedLinkService;
  logger: Logger;
  maxFileBytes: number;
  scanner?: Scanner;
  /** When true a scanner is mandatory: the service refuses to be created without one. */
  requireScan?: boolean;
  now?: () => Date;
  newId?: () => string;
}

export const DOWNLOAD_PATH = '/api/v1/files/download';

/** First segment of the generated storage key. */
const KEY_PREFIX = {
  receipts: 'receipts',
  employeeDocuments: 'employee-documents',
  profilePhotos: 'profile-photos',
} as const;

export function createStorageService({
  adapter,
  signer,
  logger,
  maxFileBytes,
  scanner,
  requireScan = false,
  now = () => new Date(),
  newId = randomUUID,
}: StorageServiceOptions): StorageService {
  if (requireScan && !scanner) {
    throw new Error('STORAGE_REQUIRE_SCAN is on but no virus scanner is configured');
  }

  return {
    async upload(request) {
      const policy = UPLOAD_POLICIES[request.category];
      if (!policy) {
        throw new Error('Unknown upload category');
      }
      const { contentType } = checkUpload(policy, request, maxFileBytes);
      const originalName = sanitizeFilename(request.filename);
      const size = request.body.length;

      if (scanner) {
        let verdict: { clean: boolean; reason?: string };
        try {
          verdict = await scanner.scan(request.body, { contentType, size, originalName });
        } catch (err) {
          // Fail closed: if we cannot be sure the file is clean, it is not stored.
          logger.error('virus scan failed', { category: request.category, err });
          throw new AppError(
            503,
            'SERVICE_UNAVAILABLE',
            'The file could not be checked, please try again later',
          );
        }
        if (!verdict.clean) {
          logger.warn('upload rejected by scanner', {
            category: request.category,
            uploadedBy: request.uploadedBy,
          });
          throw unprocessable('The file was rejected by the virus scan');
        }
      }

      const at = now();
      const key = [
        KEY_PREFIX[request.category],
        at.getUTCFullYear(),
        String(at.getUTCMonth() + 1).padStart(2, '0'),
        newId(),
      ].join('/');
      const sha256 = createHash('sha256').update(request.body).digest('hex');

      await adapter.put(key, request.body, {
        contentType,
        size,
        sha256,
        originalName,
        uploadedBy: request.uploadedBy,
        createdAt: at.toISOString(),
      });
      // The filename is personal data: log the key and size only.
      logger.info('file stored', { key, size, category: request.category });
      return { key, size, contentType, sha256, originalName };
    },

    async createDownloadLink(key, { subject, ttlSeconds }) {
      if (!(await adapter.exists(key))) {
        throw notFound('File not found');
      }
      const { token, expiresAt } = signer.sign({ key, subject, ttlSeconds });
      return {
        url: `${DOWNLOAD_PATH}?token=${encodeURIComponent(token)}`,
        token,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async openDownload(token, { subject }) {
      const verdict = signer.verify(token, { subject });
      if (!verdict.ok) {
        return { ok: false, reason: verdict.reason === 'expired' ? 'expired' : 'invalid' };
      }
      const file = await adapter.get(verdict.key);
      return file ? { ok: true, file } : { ok: false, reason: 'not_found' };
    },

    delete: (key) => adapter.delete(key),
    exists: (key) => adapter.exists(key),
  };
}
