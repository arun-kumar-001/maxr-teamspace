import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { signInAs } from '../rbac/rbac.testing';
import { TEST_PASSWORD } from './auth.testing';

const NEW_PASSWORD = 'A-brand-new-long-password-7';

/** Through the real route table: a password someone else set must be replaced before anything else. */
describe('a password that must be changed', () => {
  async function setup() {
    const { app, authKit } = makeApp();
    authKit.users.admin.mustChangePassword = true;
    const staff = await signInAs(app, authKit, 'admin'); // the flagged account
    return { app, authKit, staff };
  }

  it('can be told apart at sign-in: the profile says so', async () => {
    const { staff } = await setup();
    const me = await staff.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.mustChangePassword).toBe(true);
  });

  it('blocks every other request with a clear code, whatever its own permission would be', async () => {
    const { staff } = await setup();
    for (const path of [
      '/api/v1/attendance/today',
      '/api/v1/employees/me',
      '/api/v1/payslips/me',
      '/api/v1/notifications',
    ]) {
      const res = await staff.get(path);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code, path).toBe('PASSWORD_CHANGE_REQUIRED');
    }
    expect((await staff.post('/api/v1/attendance/check-in', {})).body.error.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    expect(
      (await staff.post('/api/v1/auth/verify-password', { password: TEST_PASSWORD })).status,
    ).toBe(403);
  });

  it('still lets the person change the password and sign out', async () => {
    const { staff } = await setup();
    const changed = await staff.post('/api/v1/auth/change-password', {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(changed.status).toBe(204);
    expect((await staff.post('/api/v1/auth/logout', {})).status).toBe(204);
  });

  it('opens everything again once the password has been changed', async () => {
    const { staff } = await setup();
    await staff.post('/api/v1/auth/change-password', {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect((await staff.get('/api/v1/auth/me')).body.data.user.mustChangePassword).toBe(false);
    expect((await staff.get('/api/v1/templates')).status).toBe(200);
  });

  it('is not lifted by a failed change: a wrong current password keeps the block', async () => {
    const { staff } = await setup();
    const res = await staff.post('/api/v1/auth/change-password', {
      currentPassword: 'not-the-password',
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(403);
    expect((await staff.get('/api/v1/templates')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('does not affect anyone else', async () => {
    const { app, authKit } = await setup();
    const other = await signInAs(app, authKit, 'staff');
    const res = await other.get('/api/v1/templates');
    // Staff may not read templates, but that is an ordinary 403, not the password block.
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
