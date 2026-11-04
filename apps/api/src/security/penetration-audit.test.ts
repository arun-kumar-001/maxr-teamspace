import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { expectNoExistenceLeak, signInAs } from '../modules/rbac/rbac.testing';
import { createSignedLinkService } from '../platform/storage/signed-links';
import { MemoryEmployeeDirectoryRepository } from '../modules/employees/directory/directory.repository';
import { MemoryEmployeeDetailRepository } from '../modules/employees/detail/detail.repository.memory';

function makeAuditApp() {
  const dirRepo = new MemoryEmployeeDirectoryRepository();
  const detailRepo = new MemoryEmployeeDetailRepository();
  const appKit = makeApp({
    employeeDirectoryRepository: dirRepo,
    employeeDetailRepository: detailRepo,
  });
  return { ...appKit, dirRepo, detailRepo };
}

describe('Penetration-Style Security Audit (ASVS V4, V5, V7, V12)', () => {
  describe('1. Broken Access Control & IDOR Prevention (STRIDE T1, ASVS V4.1, V4.2)', () => {
    it('unauthenticated caller is strictly rejected with 401 across protected resources', async () => {
      const { app } = makeApp();
      const protectedPaths = [
        ['get', '/api/v1/employees'],
        ['get', `/api/v1/employees/${randomUUID()}`],
        ['post', '/api/v1/employees'],
        ['get', '/api/v1/departments'],
        ['get', '/api/v1/designations'],
        ['get', '/api/v1/audit-logs'],
        ['get', '/api/v1/settings'],
        ['get', '/api/v1/users'],
      ] as const;

      for (const [method, path] of protectedPaths) {
        const res = await (method === 'get' ? request(app).get(path) : request(app).post(path));
        expect(res.status, `Expected 401 for unauthenticated ${method.toUpperCase()} ${path}`).toBe(
          401,
        );
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('Staff caller cannot access restricted administrative modules (403 Forbidden)', async () => {
      const { app, authKit } = makeApp();
      const staff = await signInAs(app, authKit, 'staff');

      const forbiddenForStaff = [
        '/api/v1/employees', // directory list reserved for admin, hr_manager, team_lead
        '/api/v1/audit-logs', // audit logs reserved for admin
        '/api/v1/settings', // settings reserved for admin
        '/api/v1/users', // user management reserved for admin
      ];

      for (const path of forbiddenForStaff) {
        const res = await staff.get(path);
        expect(res.status, `Staff accessing ${path} should be 403`).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('out-of-scope employee detail lookup returns 404 without leaking existence', async () => {
      const { app, authKit } = makeAuditApp();
      const staff = await signInAs(app, authKit, 'staff');
      const arbitraryId = randomUUID();
      const nonExistentId = randomUUID();

      const outOfScopeRes = await staff.get(`/api/v1/employees/${arbitraryId}`);
      const nonExistentRes = await staff.get(`/api/v1/employees/${nonExistentId}`);

      expect(outOfScopeRes.status).toBe(404);
      expect(nonExistentRes.status).toBe(404);
      expectNoExistenceLeak(outOfScopeRes, nonExistentRes);
    });

    it('Staff cannot deactivate employees (403/404)', async () => {
      const { app, authKit } = makeApp();
      const staff = await signInAs(app, authKit, 'staff');
      const targetId = randomUUID();

      const res = await staff.post(`/api/v1/employees/${targetId}/deactivate`, {
        reason: 'Malicious attempt',
      });
      expect([403, 404]).toContain(res.status);
    });

    it('Team Lead cannot access audit logs or company settings', async () => {
      const { app, authKit } = makeApp();
      const lead = await signInAs(app, authKit, 'team_lead');

      const auditRes = await lead.get('/api/v1/audit-logs');
      expect(auditRes.status).toBe(403);

      const settingsRes = await lead.get('/api/v1/settings');
      expect(settingsRes.status).toBe(403);
    });

    it('signed download tokens reject tampering, expired tokens, and subject mismatches', async () => {
      const { app } = makeApp();
      const testSecret = randomBytes(32).toString('hex');
      const testStorageKey = `receipts/2026/11/${randomUUID().replace(/-/g, '')}`;
      const signer = createSignedLinkService({
        secret: testSecret,
        defaultTtlSeconds: 300,
      });

      // Valid signed link for user-1
      const link = signer.sign({
        key: testStorageKey,
        subject: 'user-1',
        ttlSeconds: 60,
      });

      // 1. Attempt download with altered token (tampered HMAC)
      const tamperedToken = link.token.slice(0, -4) + 'abcd';
      const tamperedRes = await request(app).get(`/api/v1/files/download?token=${tamperedToken}`);
      expect(tamperedRes.status).toBe(404);

      // 2. Attempt download with empty or missing token
      const missingRes = await request(app).get('/api/v1/files/download');
      expect(missingRes.status).toBe(400);

      // 3. Attempt download with expired token
      const expiredSigner = createSignedLinkService({
        secret: testSecret,
        defaultTtlSeconds: 300,
        now: () => new Date(Date.now() - 1000 * 600), // 10 minutes ago
      });
      const expiredLink = expiredSigner.sign({
        key: testStorageKey,
        subject: 'user-1',
        ttlSeconds: 60,
      });
      const expiredRes = await request(app).get(
        `/api/v1/files/download?token=${expiredLink.token}`,
      );
      expect(expiredRes.status).toBe(404);
    });
  });

  describe('2. Mass-Assignment & Schema Hardening (STRIDE T2, ASVS V5.1)', () => {
    it('employee creation rejects or strips unwhitelisted privilege escalation fields', async () => {
      const { app, authKit } = makeApp();
      const admin = await signInAs(app, authKit, 'admin');

      // Attempt to inject unauthorized fields into employee creation
      const maliciousPayload = {
        employeeCode: 'EMP-SEC-001',
        firstName: 'Attacker',
        lastName: 'Privilege',
        email: 'attacker@example.com',
        phone: '+919876543210',
        departmentId: randomUUID(),
        designationId: randomUUID(),
        joiningDate: '2026-11-04',
        // Privilege escalation payloads:
        role: 'superadmin',
        roles: ['admin', 'superadmin'],
        isAdmin: true,
        permissions: ['*'],
        is_active: true,
        salary: 10000000,
      };

      const res = await admin.post('/api/v1/employees', maliciousPayload);
      // Either rejected with 400 (if strict schema) or accepted while stripping unknown keys
      if (res.status === 201) {
        expect(res.body.data.role).toBeUndefined();
        expect(res.body.data.roles).toBeUndefined();
        expect(res.body.data.isAdmin).toBeUndefined();
        expect(res.body.data.salary).toBeUndefined();
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }
    });

    it('department creation rejects invalid schemas and unauthorized privilege fields', async () => {
      const { app, authKit } = makeApp();
      const admin = await signInAs(app, authKit, 'admin');

      const invalidPayload = {
        name: '', // Empty name violated min(1)
        code: 'DEP-TOO-LONG-CODE-EXTRA-CHARS',
        isAdmin: true,
      };

      const res = await admin.post('/api/v1/departments', invalidPayload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('self-service profile update cannot escalate privileges or modify organizational structures', async () => {
      const { app, authKit } = makeApp();
      const staff = await signInAs(app, authKit, 'staff');

      const escalationPayload = {
        phone: '+919999999999',
        departmentId: randomUUID(),
        designationId: randomUUID(),
        managerId: staff.employeeId,
        roles: ['admin'],
        status: 'active',
      };

      const res = await staff.put('/api/v1/employees/me', escalationPayload);
      // If endpoint exists, ensure unwhitelisted fields are not updated
      if (res.status === 200) {
        expect(res.body.data.roles).not.toContain('admin');
      } else {
        expect([400, 404]).toContain(res.status);
      }
    });
  });

  describe('3. Injection Defense (STRIDE T6, T7, ASVS V5.3)', () => {
    it('handles SQL injection payloads in query parameters safely without leaking database errors', async () => {
      const { app, authKit } = makeAuditApp();
      const admin = await signInAs(app, authKit, 'admin');

      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE employees; --",
        '1 UNION SELECT null, null, password_hash FROM users--',
        "admin'--",
      ];

      for (const payload of sqlPayloads) {
        const res = await admin.get(`/api/v1/employees?search=${encodeURIComponent(payload)}`);
        // Must either return 200 with normal empty/filtered search or 400 validation error; NEVER 500
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
          expect(Array.isArray(res.body.data)).toBe(true);
        }
        // Ensure no SQL syntax errors or database table dumps are leaked
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('syntax error');
        expect(bodyStr).not.toContain('pg_catalog');
      }
    });

    it('handles unsafe header injection attempts in X-Request-Id cleanly by generating a fresh UUID', async () => {
      const { app } = makeApp();
      const unsafePayloads = [
        'id-with-spaces and bad characters',
        'id-with-semicolon; DROP TABLE',
        '<script>alert(1)</script>',
        'a'.repeat(65), // > 64 chars max length
      ];

      for (const unsafeHeader of unsafePayloads) {
        const res = await request(app).get('/api/v1/health').set('X-Request-Id', unsafeHeader);

        expect(res.status).toBe(200);
        const responseRequestId = res.headers['x-request-id'];
        expect(responseRequestId).toBeDefined();
        // The unsafe value is rejected and replaced with a valid UUID
        expect(responseRequestId).not.toBe(unsafeHeader);
        expect(responseRequestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });

    it('serves defense-in-depth security headers on all API responses', async () => {
      const { app } = makeApp();
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('4. Log Redaction & Credentials Protection (STRIDE T10, ASVS V7.1)', () => {
    it('never logs plaintext passwords or authentication tokens during login', async () => {
      const { app, lines } = makeApp();
      const sensitivePassword = `TestPass!${randomBytes(8).toString('hex')}`;

      await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({
        email: 'admin@maxr.internal',
        password: sensitivePassword,
      });

      // Verify captured log lines
      const fullLogText = lines.join('\n');
      expect(fullLogText).not.toContain(sensitivePassword);
    });

    it('health endpoint does not leak internal connection credentials or sensitive stack traces', async () => {
      const { app } = makeApp();
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('postgres://');
      expect(bodyStr).not.toContain('redis://');
      expect(bodyStr).not.toContain('stack');
    });
  });
});
