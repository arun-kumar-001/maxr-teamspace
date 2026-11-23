import type { Pool } from 'pg';
import { getLogger } from '../logging/logger';
import { createPlatform } from '../platform';
import { InMemoryAuditStore } from '../platform/audit/stores';
import { InMemoryNotificationOutbox } from '../platform/notifications/outbox';
import type { StorageService } from '../platform/storage/storage-service';
import { closePool, getPool } from './client';

const BATCH = 100;

const MOMENTS = [
  { moment: 'check-in', photo: 'check_in_photo', key: 'check_in_photo_key' },
  { moment: 'check-out', photo: 'check_out_photo', key: 'check_out_photo_key' },
] as const;

export interface MovePhotosResult {
  moved: number;
  /** Photos storage refused (not a PNG/JPEG, too big, failed the virus scan). They stay where they are. */
  failed: Array<{ id: string; moment: string; reason: string }>;
}

/**
 * Copies photos that older attendance rows hold inline (base64 text) into private storage, then
 * clears the inline copy. Safe to run again and while the API is up: a row is only touched while it has
 * an inline photo and no key, and the inline copy is cleared only after the file is confirmed stored.
 * The API shows either form meanwhile.
 */
export async function moveAttendancePhotos(
  db: Pick<Pool, 'query'>,
  storage: StorageService,
): Promise<MovePhotosResult> {
  const result: MovePhotosResult = { moved: 0, failed: [] };
  for (const { moment, photo, key } of MOMENTS) {
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows = await db.query<{ id: string; data: string }>(
        `SELECT id, ${photo} AS data FROM attendance_records
          WHERE ${photo} IS NOT NULL AND ${key} IS NULL AND id > $1
          ORDER BY id LIMIT ${BATCH}`,
        [after],
      );
      for (const row of rows.rows) {
        after = row.id;
        const stored = await storeOne(storage, row.data, moment);
        if ('reason' in stored) {
          result.failed.push({ id: row.id, moment, reason: stored.reason });
          continue;
        }
        const updated = await db.query(
          `UPDATE attendance_records SET ${key} = $2, ${photo} = NULL
            WHERE id = $1 AND ${key} IS NULL AND ${photo} IS NOT NULL`,
          [row.id, stored.key],
        );
        if (updated.rowCount === 0) await storage.delete(stored.key).catch(() => undefined);
        else result.moved += 1;
      }
      if (rows.rows.length < BATCH) break;
    }
  }
  return result;
}

async function storeOne(
  storage: StorageService,
  dataUrl: string,
  moment: string,
): Promise<{ key: string } | { reason: string }> {
  const match = /^data:image\/(jpeg|jpg|png);base64,(.+)$/s.exec(dataUrl);
  if (!match) return { reason: 'not a PNG or JPEG data URL' };
  const isPng = match[1] === 'png';
  try {
    const file = await storage.upload({
      category: 'attendancePhotos',
      filename: `${moment}.${isPng ? 'png' : 'jpg'}`,
      declaredType: isPng ? 'image/png' : 'image/jpeg',
      body: Buffer.from(match[2]!.replace(/\s+/g, ''), 'base64'),
      uploadedBy: 'migration',
    });
    if (!(await storage.exists(file.key))) return { reason: 'the stored file could not be found' };
    return { key: file.key };
  } catch (err) {
    return { reason: err instanceof Error ? err.message : 'upload failed' };
  }
}

if (require.main === module) {
  // Only the storage service is used; the audit store and outbox stand-ins satisfy production's
  // "durable" checks and are never written to.
  const { storage } = createPlatform({
    logger: getLogger(),
    overrides: {
      auditStore: new InMemoryAuditStore(),
      outbox: new InMemoryNotificationOutbox(),
    },
  });
  moveAttendancePhotos(getPool(), storage)
    .then((result) => {
      // eslint-disable-next-line no-console
      console.info(`[MovePhotos] Moved ${result.moved} photo(s) into storage.`);
      for (const f of result.failed) {
        // eslint-disable-next-line no-console
        console.warn(`[MovePhotos] Left in place: ${f.id} ${f.moment}: ${f.reason}`);
      }
      return closePool();
    })
    .catch(async (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[MovePhotos Failed]', err instanceof Error ? err.message : String(err));
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
