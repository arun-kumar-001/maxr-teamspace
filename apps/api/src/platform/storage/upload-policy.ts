import { AppError } from '../../http/app-error';
import { validationError } from '../../http/errors';
import { extensionOf } from './filename';
import { UploadCategory } from './types';

interface FileKindInfo {
  mime: string;
  extensions: string[];
  /** The first bytes every genuine file of this kind starts with. */
  magic: number[];
}

export const FILE_KINDS = {
  pdf: { mime: 'application/pdf', extensions: ['pdf'], magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  png: {
    mime: 'image/png',
    extensions: ['png'],
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  jpeg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], magic: [0xff, 0xd8, 0xff] },
} as const satisfies Record<string, FileKindInfo>;

export type FileKind = keyof typeof FILE_KINDS;

export interface UploadPolicy {
  maxBytes: number;
  kinds: readonly FileKind[];
}

const MB = 1024 * 1024;

/** Allowed types and size per category. Modules choose a category; they cannot widen it. */
export const UPLOAD_POLICIES: Record<UploadCategory, UploadPolicy> = {
  receipts: { maxBytes: 5 * MB, kinds: ['pdf', 'png', 'jpeg'] },
  employeeDocuments: { maxBytes: 10 * MB, kinds: ['pdf', 'png', 'jpeg'] },
  profilePhotos: { maxBytes: 2 * MB, kinds: ['png', 'jpeg'] },
};

/** Detects the file type from its first bytes. Returns null if it is not a type we know. */
export function sniffKind(body: Buffer): FileKind | null {
  for (const [kind, info] of Object.entries(FILE_KINDS) as Array<[FileKind, FileKindInfo]>) {
    if (body.length >= info.magic.length && info.magic.every((byte, i) => body[i] === byte)) {
      return kind;
    }
  }
  return null;
}

function normaliseMime(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

export interface CheckedUpload {
  kind: FileKind;
  contentType: string;
}

/**
 * Decides whether an upload is acceptable. The content decides, not the client:
 * the detected type must be allowed, and the declared MIME type and the file extension must agree with it.
 */
export function checkUpload(
  policy: UploadPolicy,
  upload: { filename: string; declaredType: string; body: Buffer },
  maxBytesOverride?: number,
): CheckedUpload {
  const limit = Math.min(policy.maxBytes, maxBytesOverride ?? policy.maxBytes);

  if (upload.body.length === 0) {
    throw validationError([{ field: 'file', message: 'The file is empty', rule: 'empty' }]);
  }
  if (upload.body.length > limit) {
    throw new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      `The file is larger than the allowed ${Math.floor(limit / MB)} MB`,
    );
  }

  const kind = sniffKind(upload.body);
  if (!kind || !policy.kinds.includes(kind)) {
    throw validationError(
      [
        {
          field: 'file',
          message: `Allowed file types: ${policy.kinds.join(', ')}`,
          rule: 'unsupported_type',
        },
      ],
      'This file type is not allowed',
    );
  }

  const info: FileKindInfo = FILE_KINDS[kind];
  const mimeOk = normaliseMime(upload.declaredType) === info.mime;
  const extensionOk = info.extensions.includes(extensionOf(upload.filename));
  if (!mimeOk || !extensionOk) {
    throw validationError(
      [
        {
          field: 'file',
          message: 'The file name or type does not match the file content',
          rule: 'type_mismatch',
        },
      ],
      'This file type is not allowed',
    );
  }
  return { kind, contentType: info.mime };
}
