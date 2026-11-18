import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ADVISORY = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const EXPIRES = Date.parse('2026-12-02T00:00:00Z');
const blocking = (severity) => severity === 'high' || severity === 'critical';

/** TL-approved exception: one unpatched advisory in dev-only tooling, for fourteen days. */
export function evaluateAudit(report, lock, now = Date.now()) {
  if (report.error || !report.vulnerabilities || !lock.packages) {
    throw new Error('Invalid audit report or lockfile; audit cannot be approved');
  }
  const vulnerabilities = report.vulnerabilities;
  function allowed(name, visiting = new Set()) {
    const entry = vulnerabilities[name];
    if (!entry || visiting.has(name)) return false;
    if (!blocking(entry.severity)) return true;
    if (entry.severity === 'critical' || now >= EXPIRES) return false;
    if (!entry.nodes?.length || !entry.nodes.every((node) => lock.packages[node]?.dev === true)) {
      return false;
    }
    const next = new Set([...visiting, name]);
    return (
      entry.via?.length > 0 &&
      entry.via.every((cause) => {
        if (typeof cause === 'string') return allowed(cause, next);
        return (
          !blocking(cause.severity) ||
          (cause.name === 'picomatch' && cause.severity === 'high' && cause.url === ADVISORY)
        );
      })
    );
  }
  const names = Object.keys(vulnerabilities).filter((name) =>
    blocking(vulnerabilities[name].severity),
  );
  return {
    blocked: names.filter((name) => !allowed(name)),
    excepted: names.filter((name) => allowed(name)),
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const result = evaluateAudit(report, lock);
    if (result.excepted.length)
      console.warn(
        `Temporary dev-only exception (${ADVISORY}, expires 2026-12-02): ${result.excepted.join(', ')}`,
      );
    if (result.blocked.length) {
      console.error(`Unapproved high/critical audit findings: ${result.blocked.join(', ')}`);
      process.exitCode = 1;
    } else
      console.info(
        'Audit policy passed; production dependencies remain separately audited without exceptions.',
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
