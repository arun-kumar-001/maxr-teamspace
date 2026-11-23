import { TemplateItem, CreateTemplateInput } from '../types/template';
import { PaginatedResponse, ApiResponse } from '@maxr/shared';

const API_BASE = '/api/v1/templates';

export async function fetchTemplates(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<TemplateItem>> {
  const res = await fetch(`${API_BASE}?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch templates: ${res.statusText}`);
  }
  return res.json();
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<ApiResponse<TemplateItem>> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create template: ${res.statusText}`);
  }
  return res.json();
}
