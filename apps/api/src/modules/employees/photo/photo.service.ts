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
    const stored = await this.platform.storage.upload({
      category: 'profilePhotos',
      filename: raw.filename,
      declaredType: raw.declaredType,
      body: raw.body,
      uploadedBy: caller.actorId,
    });
    let result: { replacedKey: string | null; version: number };
    try {
      result = await this.repo.replace(caller.employeeId, stored.key);
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
        action: 'profile.photo_update',
        outcome: 'success',
        entityType: 'employee',
        entityId: caller.employeeId,
      });
    return { photoUrl: employeePhotoUrl(caller.employeeId, result.version) as string };
  }

  async remove(caller: PhotoCaller): Promise<void> {
    const key = await this.repo.clear(caller.employeeId);
    if (key) await this.platform.storage.delete(key).catch(() => undefined);
    await this.platform.audit
      .withContext({ actorId: caller.actorId, requestId: caller.requestId })
      .tryRecord({
        action: 'profile.photo_remove',
        outcome: 'success',
        entityType: 'employee',
        entityId: caller.employeeId,
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
