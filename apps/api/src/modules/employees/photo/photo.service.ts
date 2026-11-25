import { createHash } from 'node:crypto';
import type { Role } from '@maxr/shared';
import { notFound } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import type { RawUpload } from '../../../http/raw-upload';
import { ScopeFilter } from '../../rbac';
import { employeePhotoUrl, type IEmployeePhotoRepository } from './photo.types';

export interface PhotoCaller {
  actorId: string;
  employeeId: string;
  roles: readonly Role[];
  requestId?: string;
}

export interface OpenedPhoto {
  body: Buffer;
  contentType: string;
  etag: string;
}

type Deps = Pick<PlatformServices, 'audit' | 'storage'>;

/** A person's own profile photo: stored privately, shown through one stable, authenticated URL. */
export class EmployeePhotoService {
  constructor(
    private readonly repo: IEmployeePhotoRepository,
    private readonly platform: Deps,
  ) {}

  /** Replaces the caller's photo. The old file is removed once the new one is in place. */
  async upload(caller: PhotoCaller, raw: RawUpload): Promise<{ photoUrl: string }> {
    return this.store(caller.employeeId, caller, raw, 'profile.photo_update');
  }

  /**
   * Sets another employee's photo (Admin and HR, for the people in their scope, for example when
   * creating the employee). Someone out of scope looks exactly like someone who does not exist.
   */
  async uploadFor(
    employeeId: string,
    scope: ScopeFilter,
    caller: PhotoCaller,
    raw: RawUpload,
  ): Promise<{ photoUrl: string }> {
    if (!(await this.repo.isInScope(employeeId, scope))) throw notFound('Employee not found');
    return this.store(employeeId, caller, raw, 'employee.photo_update');
  }

  /** Removes another employee's photo, with the same scope rule as `uploadFor`. */
  async removeFor(employeeId: string, scope: ScopeFilter, caller: PhotoCaller): Promise<void> {
    if (!(await this.repo.isInScope(employeeId, scope))) throw notFound('Employee not found');
    await this.clear(employeeId, caller, 'employee.photo_remove');
  }

  private async store(
    employeeId: string,
    caller: PhotoCaller,
    raw: RawUpload,
    action: string,
  ): Promise<{ photoUrl: string }> {
    const stored = await this.platform.storage.upload({
      category: 'profilePhotos',
      filename: raw.filename,
      declaredType: raw.declaredType,
      body: raw.body,
      uploadedBy: caller.actorId,
    });
    let result: { replacedKey: string | null; version: number };
    try {
      result = await this.repo.replace(employeeId, stored.key);
    } catch (err) {
      await this.platform.storage.delete(stored.key).catch(() => undefined);
      throw err;
    }
    if (result.replacedKey) {
      await this.platform.storage.delete(result.replacedKey).catch(() => undefined);
    }
    await this.platform.audit
      .withContext({ actorId: caller.actorId, requestId: caller.requestId })
      .tryRecord({
        action,
        outcome: 'success',
        entityType: 'employee',
        entityId: employeeId,
      });
    return { photoUrl: employeePhotoUrl(employeeId, result.version) as string };
  }

  async remove(caller: PhotoCaller): Promise<void> {
    await this.clear(caller.employeeId, caller, 'profile.photo_remove');
  }

  private async clear(employeeId: string, caller: PhotoCaller, action: string): Promise<void> {
    const key = await this.repo.clear(employeeId);
    if (key) await this.platform.storage.delete(key).catch(() => undefined);
    await this.platform.audit
      .withContext({ actorId: caller.actorId, requestId: caller.requestId })
      .tryRecord({
        action,
        outcome: 'success',
        entityType: 'employee',
        entityId: employeeId,
      });
  }

  /** The photo of an employee in the caller's scope. Out of scope looks exactly like no photo. */
  async open(employeeId: string, scope: ScopeFilter, caller: PhotoCaller): Promise<OpenedPhoto> {
    const photo = await this.repo.find(employeeId, scope);
    if (!photo) throw notFound('Photo not found');
    // The storage service hands out bytes only for a link bound to a person; use a one-off for the caller.
    const link = await this.platform.storage.createDownloadLink(photo.key, {
      subject: caller.actorId,
      ttlSeconds: 30,
    });
    const opened = await this.platform.storage.openDownload(link.token, {
      subject: caller.actorId,
    });
    if (!opened.ok) throw notFound('Photo not found');
    return {
      body: opened.file.body,
      contentType: opened.file.meta.contentType,
      etag: `"${createHash('sha256').update(opened.file.meta.sha256).digest('hex').slice(0, 32)}"`,
    };
  }
}
