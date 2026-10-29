// Fails when package-lock.json lacks the Linux native packages CI needs.
// A lockfile regenerated on Windows/macOS over an existing node_modules can silently drop them,
// and `npm ci` then installs a tree on which the build cannot run on ubuntu runners.
import { readFileSync } from 'node:fs';

const REQUIRED = ['node_modules/@rollup/rollup-linux-x64-gnu', 'node_modules/@esbuild/linux-x64'];

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const missing = REQUIRED.filter((key) => !lock.packages?.[key]);

if (missing.length > 0) {
  console.error(`package-lock.json is missing Linux packages: ${missing.join(', ')}`);
  console.error(
    'Fix: git checkout origin/develop -- package-lock.json; delete node_modules; npm install',
  );
  process.exit(1);
}
console.log('package-lock.json contains the required Linux native packages.');
