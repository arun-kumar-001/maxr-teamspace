import express, { Request, RequestHandler } from 'express';
import { validationError } from './errors';

export interface RawUpload {
  body: Buffer;
  /** The original filename from `X-Filename` (percent-encoded). Used as metadata only. */
  filename: string;
  /** The Content-Type the client claimed. The storage service checks it against the file's content. */
  declaredType: string;
}

/**
 * Reads a file sent as the raw request body, which needs no multipart library:
 *
 *   POST /...   Content-Type: application/pdf   X-Filename: report%202026.pdf   <bytes>
 *
 * Put the returned parser after `authenticate` and the permission check, so nothing is read from
 * an anonymous caller. The size limit is enforced while reading (413); the storage service then
 * enforces the per-category limit, the allowed types and the virus scan.
 */
export function rawUploadParser(maxBytes: number): RequestHandler {
  return express.raw({ type: () => true, limit: maxBytes });
}

export function readRawUpload(req: Request): RawUpload {
  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw validationError([
      { field: 'body', message: 'Send the file as the raw request body', rule: 'required' },
    ]);
  }
  const header = req.header('x-filename');
  if (!header) {
    throw validationError([
      { field: 'header.X-Filename', message: 'This header is required', rule: 'required' },
    ]);
  }
  let filename: string;
  try {
    filename = decodeURIComponent(header);
  } catch {
    throw validationError([
      { field: 'header.X-Filename', message: 'Must be percent-encoded', rule: 'invalid_string' },
    ]);
  }
  return { body, filename, declaredType: req.header('content-type') ?? '' };
}
