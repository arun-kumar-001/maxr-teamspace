import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const env = { ...process.env, REDIS_PORT: '6380', REDIS_URL: 'redis://localhost:6380' };

console.log('[MAXR Dev] Starting API server on port 4000 and Web frontend on port 3000...');

const api = spawn('npm', ['run', 'dev:api'], {
  cwd: rootDir,
  env,
  shell: true,
  stdio: 'inherit',
});

const web = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(rootDir, 'apps/web'),
  env,
  shell: true,
  stdio: 'inherit',
});

const shutdown = () => {
  console.log('[MAXR Dev] Stopping servers...');
  api.kill();
  web.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
