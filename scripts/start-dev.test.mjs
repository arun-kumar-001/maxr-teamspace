import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SERVICES } from './start-dev.mjs';

test('npm run dev starts the API and the web app together', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.dev, 'node scripts/start-dev.mjs');
  assert.deepEqual(
    SERVICES.map((s) => [s.name, s.port]),
    [
      ['api', 4000],
      ['web', 3000],
    ],
  );
});

test('the plan names both servers and changes no environment variable', () => {
  const out = execFileSync('node', ['scripts/start-dev.mjs', '--dry-run'], { encoding: 'utf8' });
  assert.match(out, /api: npm run dev:api \(port 4000\)/);
  assert.match(out, /web: npm run dev:web \(port 3000\)/);
  const source = readFileSync(new URL('./start-dev.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /REDIS_/);
});
