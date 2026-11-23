import { z } from 'zod';
import { DOCUMENT_TYPES } from './documents.types';

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const listDocumentsQuerySchema = z.object({
  documentType: documentTypeSchema.optional(),
});

export const documentUploadHeadersSchema = z.object({
  'x-filename': z.string().min(1).max(255),
  'x-document-type': documentTypeSchema,
  'x-document-title': z.string().trim().min(1).max(200).optional(),
  'x-is-sensitive': z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const uploadMetadataQuerySchema = z.object({
  documentType: documentTypeSchema,
  title: z.string().trim().min(1).max(200),
  isSensitive: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});
