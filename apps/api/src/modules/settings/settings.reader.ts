import { ISettingsRepository } from './settings.repository';
import { BasicSettings, PermissionPolicy } from './settings.types';

/**
 * What other modules depend on (attendance, leave, reports): the company timezone and work week,
 * never the table. Implemented with a short cache so hot paths such as check-in do not hit the
 * database every time.
 */
export interface CompanySettingsReader {
  getBasic(): Promise<BasicSettings>;
  /** The short-absence limits, or null until an Admin saves them. Not part of the basic data. */
  getPermissionPolicy?(): Promise<PermissionPolicy | null>;
}

export const SETTINGS_CACHE_TTL_MS = 60_000;

/**
 * In-process cache. An update through the settings service calls `invalidate()`, so this instance
 * sees the change at once; other API instances see it within the TTL (60 s).
 */
export class CachedCompanySettingsReader implements CompanySettingsReader {
  private cached: { value: BasicSettings; expiresAt: number } | null = null;
  private cachedPermissionPolicy: { value: PermissionPolicy | null; expiresAt: number } | null =
    null;

  constructor(
    private readonly repository: Pick<ISettingsRepository, 'get'>,
    private readonly ttlMs: number = SETTINGS_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async getBasic(): Promise<BasicSettings> {
    const hit = this.cached;
    if (hit && hit.expiresAt > this.now()) {
      return hit.value;
    }
    const { companyName, timezone, workWeek } = await this.repository.get();
    const value: BasicSettings = { companyName, timezone, workWeek };
    this.cached = { value, expiresAt: this.now() + this.ttlMs };
    return value;
  }

  async getPermissionPolicy(): Promise<PermissionPolicy | null> {
    const hit = this.cachedPermissionPolicy;
    if (hit && hit.expiresAt > this.now()) {
      return hit.value;
    }
    const { permissionPolicy } = await this.repository.get();
    this.cachedPermissionPolicy = { value: permissionPolicy, expiresAt: this.now() + this.ttlMs };
    return permissionPolicy;
  }

  invalidate(): void {
    this.cached = null;
    this.cachedPermissionPolicy = null;
  }
}
