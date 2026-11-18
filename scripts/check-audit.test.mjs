import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from './check-audit.mjs';

const now = Date.parse('2026-11-18T00:00:00Z');
function fixture() {
  const cause = {
    name: 'picomatch',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  };
  const report = {
    vulnerabilities: {
      picomatch: { severity: 'high', nodes: ['node_modules/picomatch'], via: [cause] },
      vite: { severity: 'high', nodes: ['node_modules/vite'], via: ['picomatch'] },
    },
  };
  const lock = {
    packages: { 'node_modules/picomatch': { dev: true }, 'node_modules/vite': { dev: true } },
  };
  return { report, lock };
}

test('allows only the approved dev-only advisory and its dev dependency effects', () => {
  const { report, lock } = fixture();
  assert.deepEqual(evaluateAudit(report, lock, now), {
    blocked: [],
    excepted: ['picomatch', 'vite'],
  });
});
test('blocks the same advisory in a production dependency', () => {
  const { report, lock } = fixture();
  lock.packages['node_modules/picomatch'].dev = false;
  assert.deepEqual(evaluateAudit(report, lock, now).blocked, ['picomatch', 'vite']);
});
test('blocks new advisories instead of blanket-allowing a package', () => {
  const { report, lock } = fixture();
  report.vulnerabilities.picomatch.via.push({
    name: 'picomatch',
    severity: 'high',
    url: 'https://github.com/advisories/another',
  });
  assert.deepEqual(evaluateAudit(report, lock, now).blocked, ['picomatch', 'vite']);
});
test('blocks critical severity and expired exceptions', () => {
  const { report, lock } = fixture();
  assert.deepEqual(evaluateAudit(report, lock, Date.parse('2026-12-02T00:00:00Z')).blocked, [
    'picomatch',
    'vite',
  ]);
  report.vulnerabilities.picomatch.severity = 'critical';
  assert.deepEqual(evaluateAudit(report, lock, now).blocked, ['picomatch', 'vite']);
});
test('blocks missing lockfile classification and malformed reports', () => {
  const { report, lock } = fixture();
  delete lock.packages['node_modules/picomatch'];
  assert.deepEqual(evaluateAudit(report, lock, now).blocked, ['picomatch', 'vite']);
  assert.throws(() => evaluateAudit({ error: 'Registry unavailable' }, lock, now));
});
