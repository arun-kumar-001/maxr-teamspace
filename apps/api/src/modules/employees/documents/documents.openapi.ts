import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  documentIdParamSchema,
  documentTypeSchema,
  listDocumentsQuerySchema,
} from './documents.schemas';

const employeeDocumentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  uploadedByEmployeeId: z.string().uuid(),
  documentType: documentTypeSchema,
  title: z.string(),
  isSensitive: z.boolean(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

registerRoute({
  method: 'get',
  path: '/employees/{id}/documents',
  tags: ['Employees'],
  summary: 'List employee document metadata',
  permission: 'documents.read',
  params: idParamSchema,
  query: listDocumentsQuerySchema,
  success: {
    status: 200,
    description: 'List of employee document metadata',
    schema: z.object({ data: z.array(employeeDocumentSchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/employees/{id}/documents',
  tags: ['Employees'],
  summary: 'Upload an employee document via raw request body',
  permission: 'documents.upload',
  params: idParamSchema,
  upload: {
    contentTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  },
  success: {
    status: 201,
    description: 'Uploaded employee document metadata',
    schema: z.object({ data: employeeDocumentSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/employees/{id}/documents/{docId}/download-link',
  tags: ['Employees'],
  summary: 'Generate ephemeral signed download link for an employee document',
  permission: 'documents.download',
  params: documentIdParamSchema,
  success: {
    status: 200,
    description: 'Signed download link',
    schema: z.object({
      data: z.object({
        url: z.string(),
        expiresAt: z.string(),
      }),
    }),
  },
});

registerRoute({
  method: 'delete',
  path: '/employees/{id}/documents/{docId}',
  tags: ['Employees'],
  summary: 'Soft delete an employee document',
  permission: 'documents.delete',
  params: documentIdParamSchema,
  success: {
    status: 204,
    description: 'Document successfully deleted',
  },
});
