import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DEPLOY = path.resolve(__dirname, '../../../../deploy');
const read = (file: string) => fs.readFileSync(path.join(DEPLOY, file), 'utf8');

/** The production files are code too: a wrong default here ships a weakness to every install. */
describe('production stack (deploy/)', () => {
  const compose = read('docker-compose.prod.yml');

  describe('deploy script', () => {
    it('waits for the database under the user and name from the env file, not fixed ones', () => {
      const script = read('server-deploy.sh');
      expect(script).toContain(
        'pg_isready -U "${DB_USER_NAME:-maxr}" -d "${DB_DATABASE:-maxr_teamspace}"',
      );
      expect(script).not.toMatch(/pg_isready -U maxr -d maxr_teamspace/);
    });
  });

  describe('nginx', () => {
    const nginx = read('nginx/nginx.conf');

    it('lets a page of employee photos load at once, with a larger burst than other API calls', () => {
      const block = nginx.slice(nginx.indexOf('location ~ "^/api/v1/employees/'));
      // Braces inside an unquoted regex make nginx fail with "unknown directive": it must be quoted.
      expect(block).toContain('location ~ "^/api/v1/employees/[0-9a-f-]{36}/photo$" {');
      expect(block.slice(0, 300)).toContain('limit_req zone=api burst=200 nodelay;');
      expect(block.slice(0, 300)).toContain('include /etc/nginx/api-proxy.conf;');
    });

    it('quotes every regex location that contains braces (unquoted, nginx fails to start)', () => {
      const regexLocations = nginx
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^location\s+~\*?\s/.test(line));
      expect(regexLocations.length).toBeGreaterThan(0);
      for (const line of regexLocations) {
        const pattern = line.replace(/^location\s+~\*?\s+/, '').replace(/\s*\{\s*$/, '');
        if (/[{}]/.test(pattern)) expect(pattern, line).toMatch(/^(".*"|'.*')$/);
      }
    });

    it('still accepts the largest upload the API takes', () => {
      expect(nginx).toMatch(/client_max_body_size 12m;/);
    });
  });

  describe('email', () => {
    it('does not default SMTP_HOST to this machine, so a missing value is caught at start-up', () => {
      expect(compose).toContain('SMTP_HOST: ${SMTP_HOST:-}');
      expect(compose).not.toMatch(/SMTP_HOST:.*localhost/);
    });
  });

  describe('payslip PDF', () => {
    it('ships the logo the PDF draws into the API image, where the PDF code looks for it', () => {
      const dockerfile = read('Dockerfile.api');
      expect(dockerfile).toContain(
        'COPY --chown=node:node apps/web/public/maxr.png ./apps/web/public/maxr.png',
      );
      expect(fs.existsSync(path.resolve(DEPLOY, '../apps/web/public/maxr.png'))).toBe(true);
    });
  });

  describe('encryption of identity and bank numbers', () => {
    it('refuses to start the API without a field encryption key', () => {
      expect(compose).toContain('FIELD_ENCRYPTION_KEY: ${FIELD_ENCRYPTION_KEY:?');
    });

    it('generates a key for a new install, and never replaces one that is already set', () => {
      const script = read('server-deploy.sh');
      expect(script).toMatch(/^FIELD_ENCRYPTION_KEY=\$\{FIELD_KEY\}$/m);
      // Only added when missing or empty: replacing it would make stored numbers unreadable.
      expect(script).toContain('! grep -q "^FIELD_ENCRYPTION_KEY=." "$ENV_FILE"');
    });

    it('lists the key, empty, in the production env template', () => {
      expect(read('.env.production.example')).toMatch(/^FIELD_ENCRYPTION_KEY=$/m);
    });
  });

  describe('virus scanning of uploads', () => {
    it('runs a ClamAV service on the internal network only, with its signatures kept', () => {
      const service = compose.slice(compose.indexOf('\n  clamav:'), compose.indexOf('\n  api:'));
      expect(service).toContain('image: clamav/clamav:');
      expect(service).toContain('networks: [internal]');
      expect(service).not.toMatch(/\n\s+ports:/);
      expect(service).toContain('clamav_data:/var/lib/clamav');
    });

    it('makes the API wait for a healthy scanner before it starts', () => {
      const api = compose.slice(compose.indexOf('\n  api:'), compose.indexOf('\n  migrate:'));
      expect(api).toMatch(/clamav:\s*\n\s+condition: service_healthy/);
    });

    it('requires a scan by default and points the API at the scanner', () => {
      expect(compose).toContain('STORAGE_REQUIRE_SCAN: ${STORAGE_REQUIRE_SCAN:-true}');
      expect(compose).toContain('CLAMAV_HOST: clamav');
      expect(compose).not.toMatch(/STORAGE_REQUIRE_SCAN:.*:-false/);
    });

    it('does not suggest turning the scan off in the production env template', () => {
      expect(read('.env.production.example')).toMatch(/^STORAGE_REQUIRE_SCAN=true$/m);
    });

    it('does not make the deploy script write the scan off into a new env file', () => {
      const script = read('server-deploy.sh');
      expect(script).toMatch(/^STORAGE_REQUIRE_SCAN=true$/m);
      expect(script).not.toMatch(/STORAGE_REQUIRE_SCAN=false" >>/);
      // An existing file that still says false is flagged, not silently trusted.
      expect(script).toContain('WARNING');
    });
  });

  describe('browser permissions', () => {
    const header = read('nginx/security-headers.conf');

    it('lets the app itself ask for the camera and location that check-in needs', () => {
      expect(header).toMatch(/Permissions-Policy "[^"]*camera=\(self\)/);
      expect(header).toMatch(/Permissions-Policy "[^"]*geolocation=\(self\)/);
    });

    it('still withholds the microphone, and location from every other origin', () => {
      expect(header).toMatch(/Permissions-Policy "[^"]*microphone=\(\)/);
      expect(header).not.toMatch(/geolocation=\(\*\)/);
    });

    it('keeps the page from calling outside hosts (position data stays in the app)', () => {
      expect(header).toContain("connect-src 'self'");
    });
  });
});
