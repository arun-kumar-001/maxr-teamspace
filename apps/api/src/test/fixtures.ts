import type { Request } from 'express';
/** Small, valid-looking files for upload tests (only the first bytes matter to the type check). */
export const pdf = (extra = ''): Buffer =>
  Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n'), Buffer.from(extra)]);

export const png = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 1),
  ]);

export const jpeg = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);

/** A Windows program: must never be accepted, whatever it is called. */
export const exe = (): Buffer => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);

export const html = (): Buffer => Buffer.from('<html><script>alert(1)</script></html>');

/** A signed-in user for tests that set `req.actor` by hand. */
export const testActor = (id: string): NonNullable<Request['actor']> => ({
  id,
  employeeId: id,
  role: 'staff',
  roles: ['staff'],
});
