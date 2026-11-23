import { z } from 'zod';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  templateSchema,
  updateTemplateSchema,
} from './template.schemas';

/** Domain entity and DTOs are derived from the Zod schemas, so types and validation cannot drift. */
export type TemplateEntity = z.infer<typeof templateSchema>;
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
export type TemplateListQuery = z.infer<typeof listTemplatesQuerySchema>;
