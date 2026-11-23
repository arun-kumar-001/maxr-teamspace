import { ScopeFilter, scopeAllows } from '../../rbac';
import type { IEmployeePhotoRepository, StoredPhoto } from './photo.types';

/** In-memory photos for unit and HTTP tests (not shipped in the build). */
export class MemoryEmployeePhotoRepository implements IEmployeePhotoRepository {
  private photos = new Map<string, StoredPhoto>();
  private clock = 1_000;

  constructor(private readonly managerOf: (employeeId: string) => string | null = () => null) {}

  async find(employeeId: string, scope: ScopeFilter) {
    if (!scopeAllows(scope, employeeId, this.managerOf(employeeId))) return null;
    return this.photos.get(employeeId) ?? null;
  }

  async replace(employeeId: string, key: string) {
    const replacedKey = this.photos.get(employeeId)?.key ?? null;
    const version = (this.clock += 1);
    this.photos.set(employeeId, { key, version });
    return { replacedKey, version };
  }

  async clear(employeeId: string) {
    const key = this.photos.get(employeeId)?.key ?? null;
    this.photos.delete(employeeId);
    return key;
  }
}
