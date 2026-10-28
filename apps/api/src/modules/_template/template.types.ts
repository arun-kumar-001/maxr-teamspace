/**
 * Template Module Types & Data Transfer Objects (DTOs)
 */

export interface TemplateEntity {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface TemplateFilterQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
