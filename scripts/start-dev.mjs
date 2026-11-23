// Starts the API and the web app together. `npm run dev --workspaces` starts them one after the
// other, and the API's watcher never exits, so the web app would never start.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SERVICES = [
  { name: 'api', args: ['run', 'dev:api'], port: 4000 },
  { name: 'web', args: ['run', 'dev:web'], port: 3000 },
];

const isWindows = process.platform === 'win32';

// npm starts the real server as a child of its own process, so the whole tree is stopped: with
// taskkill on Windows, and by signalling the process group each server was started in elsewhere.
function stop(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function main() {
  if (process.argv.includes('--dry-run')) {
    for (const s of SERVICES) console.log(`${s.name}: npm ${s.args.join(' ')} (port ${s.port})`);
    return;
  }

  console.log('[MAXR Dev] Starting the API on port 4000 and the web app on port 3000...');
  const children = SERVICES.map((s) =>
    spawn('npm', s.args, {
      cwd: rootDir,
      env: process.env,
      shell: true,
      stdio: 'inherit',
      detached: !isWindows,
    }),
  );

  let stopping = false;
  const shutdown = (code) => {
    if (stopping) return;
    stopping = true;
    console.log('[MAXR Dev] Stopping servers...');
    children.forEach(stop);
    process.exitCode = code;
  };

  // One server stopping on its own (a port in use, a crash) brings the other down, so a half
  // running app is never left behind.
  children.forEach((child, i) =>
    child.on('exit', (code) => {
      if (!stopping)
        console.error(`[MAXR Dev] ${SERVICES[i].name} stopped (exit ${code ?? 'signal'}).`);
      shutdown(code ?? 1);
    }),
  );
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
