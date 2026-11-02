export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
}
