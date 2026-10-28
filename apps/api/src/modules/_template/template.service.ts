import { ITemplateRepository } from './template.repository';
import {
  TemplateEntity,
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateFilterQuery,
} from './template.types';
import { PaginatedResponse, ERROR_CODES } from '@maxr/shared';
import { AppError } from '../../middleware/error-handler';

export class TemplateService {
  constructor(private readonly repository: ITemplateRepository) {}

  async getById(id: string, scopeFilter?: string[]): Promise<TemplateEntity> {
    const item = await this.repository.findById(id, scopeFilter);
    if (!item) {
      // Per AGENTS.md §5: prefer 404 over 403 to prevent existence leakage
      throw new AppError(404, ERROR_CODES.NOT_FOUND, `Template record '${id}' not found`);
    }
    return item;
  }

  async list(
    filter: TemplateFilterQuery,
    scopeFilter?: string[],
  ): Promise<PaginatedResponse<TemplateEntity>> {
    return this.repository.findMany(filter, scopeFilter);
  }

  async create(dto: CreateTemplateDto, actorUserId: string): Promise<TemplateEntity> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, 'Template name is required', [
        { field: 'name', message: 'Name cannot be empty', rule: 'required' },
      ]);
    }

    if (dto.name.length > 100) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, 'Template name exceeds 100 characters', [
        { field: 'name', message: 'Maximum length is 100 characters', rule: 'maxLength' },
      ]);
    }

    return this.repository.create(
      {
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
      actorUserId,
    );
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    scopeFilter?: string[],
  ): Promise<TemplateEntity> {
    // Check existence and scope access
    await this.getById(id, scopeFilter);

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, 'Template name cannot be empty', [
        { field: 'name', message: 'Name cannot be empty', rule: 'notEmpty' },
      ]);
    }

    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, `Template record '${id}' not found`);
    }

    return updated;
  }

  async deactivate(id: string, scopeFilter?: string[]): Promise<void> {
    await this.getById(id, scopeFilter);
    const success = await this.repository.softDelete(id);
    if (!success) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, `Template record '${id}' not found`);
    }
  }
}
