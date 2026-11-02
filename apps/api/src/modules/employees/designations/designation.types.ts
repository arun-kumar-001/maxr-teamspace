import { z } from 'zod';
import {
  createDesignationSchema,
  designationSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas';

export type DesignationEntity = z.infer<typeof designationSchema>;
export type CreateDesignationDto = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationDto = z.infer<typeof updateDesignationSchema>;
export type DesignationListQuery = z.infer<typeof listDesignationsQuerySchema>;
