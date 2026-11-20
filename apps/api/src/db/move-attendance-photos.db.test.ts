import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { createTestPlatform } from '../platform';
import { closePool, getPool } from './client';
import { moveAttendancePhotos } from './move-attendance-photos';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png body'),
]);
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;
const JPEG_URL = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('jpeg body')]).toString('base64')}`;
const NOT_AN_IMAGE_URL = `data:image/png;base64,${Buffer.from('<html>').toString('base64')}`;
const WEBP_URL = 'data:image/webp;base64,UklGRg==';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('moving inline attendance photos into storage, against PostgreSQL', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', emp: '' };
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const db = () => outer as unknown as Pool;

  const row = async (workDate: string, photos: { in?: string; out?: string }) =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time,
           check_in_photo, check_out_photo)
         VALUES ($1, $2, '2027-04-01T03:30:00Z', '2027-04-01T12:30:00Z', $3, $4) RETURNING id`,
        [ids.emp, workDate, photos.in ?? null, photos.out ?? null],
      )
    ).rows[0]!.id;
  const state = async (id: string) =>
    (
      await outer.query<{
        ip: string | null;
        op: string | null;
        ik: string | null;
        ok: string | null;
      }>(
        `SELECT check_in_photo ip, check_out_photo op, check_in_photo_key ik, check_out_photo_key ok
           FROM attendance_records WHERE id = $1`,
        [id],
      )
    ).rows[0]!;

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Move ${run}`, `MOVE-${run}`],
      )
    ).rows[0]!.id;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
        [ids.dept],
      )
    ).rows[0]!.id;
    ids.emp = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, 'M', 'P', $2, $3, $4) RETURNING id`,
        [`MV-${run}`, `mv-${run}@move.test`, ids.dept, ids.desig],
      )
    ).rows[0]!.id;
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  const newStorage = () => createTestPlatform({ logger: silent }).platform.storage;

  it('copies each photo into storage, records the key and clears the inline copy', async () => {
    const storage = newStorage();
    const id = await row('2027-04-01', { in: PNG_URL, out: JPEG_URL });

    const result = await moveAttendancePhotos(db(), storage);
    expect(result.moved).toBeGreaterThanOrEqual(2);

    const s = await state(id);
    expect(s.ip).toBeNull();
    expect(s.op).toBeNull();
    expect(s.ik).toMatch(/^attendance-photos\//);
    expect(s.ok).toMatch(/^attendance-photos\//);
    expect(await storage.exists(s.ik!)).toBe(true);

    const link = await storage.createDownloadLink(s.ik!, { subject: 'u1' });
    const opened = await storage.openDownload(link.token, { subject: 'u1' });
    expect(opened.ok && opened.file.body.equals(PNG)).toBe(true);
  });

  it('is safe to run again: nothing left to move, nothing changed', async () => {
    const storage = newStorage();
    const id = await row('2027-04-02', { in: PNG_URL });
    await moveAttendancePhotos(db(), storage);
    const before = await state(id);

    const again = await moveAttendancePhotos(db(), storage);
    expect(again).toEqual({ moved: 0, failed: [] });
    expect(await state(id)).toEqual(before);
  });

  it('leaves a photo storage refuses where it is, and says so', async () => {
    const storage = newStorage();
    const bad = await row('2027-04-03', { in: NOT_AN_IMAGE_URL });
    const webp = await row('2027-04-04', { in: WEBP_URL });
    const good = await row('2027-04-05', { in: PNG_URL });

    const result = await moveAttendancePhotos(db(), storage);

    expect(result.failed.map((f) => f.id).sort()).toEqual([bad, webp].sort());
    expect(await state(bad)).toMatchObject({ ip: NOT_AN_IMAGE_URL, ik: null });
    expect(await state(webp)).toMatchObject({ ip: WEBP_URL, ik: null });
    expect((await state(good)).ik).toMatch(/^attendance-photos\//);
  });

  it('does not touch a row that already has a key', async () => {
    const storage = newStorage();
    const id = await row('2027-04-06', { in: PNG_URL });
    await outer.query(
      `UPDATE attendance_records SET check_in_photo_key = 'attendance-photos/x/y/z' WHERE id = $1`,
      [id],
    );

    await moveAttendancePhotos(db(), storage);
    expect(await state(id)).toMatchObject({ ip: PNG_URL, ik: 'attendance-photos/x/y/z' });
  });
});
