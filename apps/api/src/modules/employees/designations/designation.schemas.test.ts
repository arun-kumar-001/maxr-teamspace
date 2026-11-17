import { describe, expect, it } from 'vitest';
import {
  createDesignationSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas';

describe('designation contract without business codes', () => {
  const input = {
    departmentId: '10000000-0000-4000-8000-000000000001',
    title: 'AI Engineer',
  };

  it('creates a designation using its department and title', () => {
    expect(createDesignationSchema.parse(input)).toEqual(input);
  });

  it('rejects the removed code property on create and update', () => {
    expect(createDesignationSchema.safeParse({ ...input, code: 'AI-ENG' }).success).toBe(false);
    expect(updateDesignationSchema.safeParse({ code: 'AI-ENG' }).success).toBe(false);
  });

  it('accepts existing Management department IDs for create, update and filtering', () => {
    const departmentId = '30000000-0000-0000-0000-000000000001';
    expect(createDesignationSchema.parse({ ...input, departmentId }).departmentId).toBe(
      departmentId,
    );
    expect(updateDesignationSchema.parse({ departmentId }).departmentId).toBe(departmentId);
    expect(listDesignationsQuerySchema.parse({ departmentId }).departmentId).toBe(departmentId);
  });

  it('rejects malformed department IDs', () => {
    const departmentId = 'invalid-department';
    expect(createDesignationSchema.safeParse({ ...input, departmentId }).success).toBe(false);
    expect(updateDesignationSchema.safeParse({ departmentId }).success).toBe(false);
    expect(listDesignationsQuerySchema.safeParse({ departmentId }).success).toBe(false);
  });
});
