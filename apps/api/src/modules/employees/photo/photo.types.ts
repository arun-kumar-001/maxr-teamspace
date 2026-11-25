import type { ScopeFilter } from '../../rbac';

export interface StoredPhoto {
  key: string;
  /** Changes whenever the photo is replaced; used to bust browser caches. */
  version: number;
}

export interface IEmployeePhotoRepository {
  /** The photo of an employee inside the caller's scope; null when none, or out of scope. */
  find(employeeId: string, scope: ScopeFilter): Promise<StoredPhoto | null>;
  /** Whether the employee exists inside the caller's scope. */
  isInScope(employeeId: string, scope: ScopeFilter): Promise<boolean>;
  /** Stores the key of a new photo and returns the key it replaced, if any. */
  replace(
    employeeId: string,
    key: string,
  ): Promise<{ replacedKey: string | null; version: number }>;
  /** Removes the photo and returns its key, if there was one. */
  clear(employeeId: string): Promise<string | null>;
}

/** The stable URL of an employee's photo. `version` only busts caches; it is not a secret. */
export const employeePhotoUrl = (employeeId: string, version: number | null): string | null =>
  version === null ? null : `/api/v1/employees/${employeeId}/photo?v=${version}`;
