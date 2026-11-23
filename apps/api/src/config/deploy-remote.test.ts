import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../deploy/scripts/deploy-remote.sh');
const SHA = 'a'.repeat(40);

/**
 * Runs the real script with a fake `ssh` first on the PATH. The fake writes down how it was called
 * (arguments, standard input, and the mode and content of the key and known_hosts files it was
 * given) so the tests can check the connection without a server.
 */
describe('deploy/scripts/deploy-remote.sh', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-remote-'));
    fs.writeFileSync(
      path.join(dir, 'ssh'),
      `#!/usr/bin/env bash
echo ssh >>"${dir}/calls"
printf '%s\\n' "$@" >"${dir}/args"
cat >"${dir}/stdin"
key=""; hosts=""
while [ $# -gt 0 ]; do
  case "$1" in
    -i) key="$2"; shift 2 ;;
    -o) case "$2" in UserKnownHostsFile=*) hosts="\${2#UserKnownHostsFile=}" ;; esac; shift 2 ;;
    *) shift ;;
  esac
done
stat -c %a "$key" >"${dir}/key_mode"
cat "$key" >"${dir}/key_content"
cat "$hosts" >"${dir}/hosts_content"
exit "\${FAKE_SSH_EXIT:-0}"
`,
      { mode: 0o755 },
    );
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (env: Record<string, string>) =>
    spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      env: { PATH: `${dir}:${process.env.PATH ?? ''}`, HOME: dir, ...env },
    });
  const sshCalls = () =>
    fs.existsSync(path.join(dir, 'calls')) ? fs.readFileSync(path.join(dir, 'calls'), 'utf8') : '';
  const secrets = {
    CANTOBO_HOST: 'teamspace.example.com',
    CANTOBO_SSH_KEY: '-----BEGIN KEY-----\nsecret\n-----END KEY-----',
    CANTOBO_KNOWN_HOSTS: 'teamspace.example.com ssh-ed25519 AAAAhostkey',
  };

  describe('when it cannot deploy', () => {
    it('fails, rather than reporting success, when the secrets are not set', () => {
      const res = run({ DEPLOY_REF: SHA });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('CANTOBO_HOST');
      expect(res.stderr).toContain('Nothing was deployed');
      expect(sshCalls()).toBe('');
    });

    it('names every missing secret, including the pinned host key', () => {
      const res = run({ DEPLOY_REF: SHA, CANTOBO_HOST: 'h.example.com' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('CANTOBO_SSH_KEY');
      expect(res.stderr).toContain('CANTOBO_KNOWN_HOSTS');
    });

    it('a dry run without secrets says plainly that nothing was deployed', () => {
      const res = run({ DEPLOY_REF: SHA, DRY_RUN: 'true' });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('NOTHING WAS DEPLOYED');
      expect(sshCalls()).toBe('');
    });

    it('a dry run with every secret still does not connect', () => {
      const res = run({ DEPLOY_REF: SHA, DRY_RUN: 'true', ...secrets });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('NOTHING WAS DEPLOYED');
      expect(sshCalls()).toBe('');
    });
  });

  describe('refuses values that could change the remote command', () => {
    it.each([
      ['a branch name instead of a commit SHA', { DEPLOY_REF: 'main' }],
      ['a SHA with a command appended', { DEPLOY_REF: `${SHA}; touch /tmp/pwned` }],
      ['an app directory with shell characters', { DEPLOY_REF: SHA, APP_DIR: '/opt/app; id' }],
      ['a relative app directory', { DEPLOY_REF: SHA, APP_DIR: 'opt/app' }],
      ['a user name with a space', { DEPLOY_REF: SHA, CANTOBO_USER: 'a b' }],
      ['a host name with a command', { DEPLOY_REF: SHA, CANTOBO_HOST: 'h.example.com;id' }],
    ])('%s', (_name, env) => {
      const res = run({ ...secrets, ...env });
      expect(res.status).toBe(1);
      expect(sshCalls()).toBe('');
    });
  });

  describe('when it deploys', () => {
    it('connects with a pinned host key and no password prompts, as the deploy user', () => {
      const res = run({ DEPLOY_REF: SHA, ...secrets });
      expect(res.status).toBe(0);
      const args = fs.readFileSync(path.join(dir, 'args'), 'utf8');
      expect(args).toContain('StrictHostKeyChecking=yes');
      expect(args).toContain('BatchMode=yes');
      expect(args).toContain('deploy@teamspace.example.com');
      // The commit and directory go in as arguments of `bash -s`, never spliced into a command.
      expect(args).toMatch(/bash\n-s\n--\n\/opt\/maxr-teamspace\n/);
      expect(args).toContain(SHA);
    });

    it('gives ssh the key and the pinned host key, readable only by the owner', () => {
      run({ DEPLOY_REF: SHA, ...secrets });
      expect(fs.readFileSync(path.join(dir, 'key_mode'), 'utf8').trim()).toBe('600');
      expect(fs.readFileSync(path.join(dir, 'key_content'), 'utf8')).toContain('secret');
      expect(fs.readFileSync(path.join(dir, 'hosts_content'), 'utf8')).toContain('AAAAhostkey');
    });

    it('runs the real deploy script on the host and waits for the API to be healthy', () => {
      run({ DEPLOY_REF: SHA, ...secrets });
      const remote = fs.readFileSync(path.join(dir, 'stdin'), 'utf8');
      expect(remote).toContain('git checkout --detach "$ref"');
      expect(remote).toContain('./deploy/server-deploy.sh');
      expect(remote).toContain('/api/v1/health');
    });

    it('does not leave the key behind on the runner', () => {
      run({ DEPLOY_REF: SHA, ...secrets });
      const keyPath = fs.readFileSync(path.join(dir, 'args'), 'utf8').split('\n')[1] ?? '';
      expect(keyPath).toContain('/');
      expect(fs.existsSync(keyPath)).toBe(false);
    });

    it('fails when the deployment on the host fails', () => {
      const res = run({ DEPLOY_REF: SHA, FAKE_SSH_EXIT: '1', ...secrets });
      expect(res.status).not.toBe(0);
    });

    it('honours a different user and directory', () => {
      run({
        DEPLOY_REF: SHA,
        CANTOBO_USER: 'maxr',
        APP_DIR: '/srv/teamspace',
        ...secrets,
      });
      const args = fs.readFileSync(path.join(dir, 'args'), 'utf8');
      expect(args).toContain('maxr@teamspace.example.com');
      expect(args).toContain('/srv/teamspace');
    });
  });
});
