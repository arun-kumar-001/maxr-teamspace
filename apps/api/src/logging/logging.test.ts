import { describe, expect, it } from 'vitest';
import { at } from '../test/at';
import { agentAs } from '../modules/rbac/rbac.testing';
import { makeApp } from '../test/helpers';
import { createLogger, parseLogLevel } from './logger';
import { REDACTED, isSensitiveKey, redact, scrubText } from './redact';

describe('redaction (TC-9-14)', () => {
  it('redacts sensitive keys at any depth, in arrays, case and separator insensitive', () => {
    const out = redact({
      user: {
        name: 'Asha',
        Password: 'p',
        password_hash: 'h',
        profile: { bankAccount: '123', iban: 'DE00' },
      },
      list: [{ token: 't1 ' }, { accessToken: 't2' }],
      headers: { Authorization: 'Bearer x', 'set-cookie': 'a=b', cookie: 'c=d' },
      salary: 100,
      ssn: '000-00-0000',
    });

    expect(at(out, 'user', 'name')).toBe('Asha');
    expect(at(out, 'user', 'Password')).toBe(REDACTED);
    expect(at(out, 'user', 'password_hash')).toBe(REDACTED);
    expect(at(out, 'user', 'profile', 'bankAccount')).toBe(REDACTED);
    expect(at(out, 'user', 'profile', 'iban')).toBe(REDACTED);
    expect(at(out, 'list', '0', 'token')).toBe(REDACTED);
    expect(at(out, 'list', '1', 'accessToken')).toBe(REDACTED);
    expect(at(out, 'headers')).toEqual({
      Authorization: REDACTED,
      'set-cookie': REDACTED,
      cookie: REDACTED,
    });
    expect(at(out, 'salary')).toBe(REDACTED);
    expect(at(out, 'ssn')).toBe(REDACTED);
  });

  it('does not redact harmless keys that merely contain short sensitive letters', () => {
    expect(isSensitiveKey('className')).toBe(false);
    expect(isSensitiveKey('passenger')).toBe(false);
    expect(isSensitiveKey('requestId')).toBe(false);
    expect(isSensitiveKey('refreshToken')).toBe(true);
    expect(isSensitiveKey('x-api-key')).toBe(true);
  });

  it('survives circular references, deep nesting, errors, dates and bigints', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    const out = redact({
      a,
      when: new Date('2026-01-02T03:04:05Z'),
      big: 10n,
      err: new Error('boom'),
    });
    expect(at(out, 'a', 'self')).toBe('[Circular]');
    expect(at(out, 'when')).toBe('2026-01-02T03:04:05.000Z');
    expect(at(out, 'big')).toBe('10');
    expect(at(out, 'err', 'message')).toBe('boom');
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(JSON.stringify(redact(deep))).toContain('[MaxDepth]');
  });

  it('truncates very long strings', () => {
    expect((redact('x'.repeat(5000)) as string).length).toBeLessThan(2100);
  });
});

describe('redaction of secrets inside text (TC-9-14)', () => {
  it.each([
    ['connect failed password=hunter2 host=db', 'hunter2'],
    ['login with token: abc123SECRET rejected', 'abc123SECRET'],
    ['{"apiKey":"sk_live_999","ok":true}', 'sk_live_999'],
    ['Authorization: Bearer eyJhbGciOi.payload.sig', 'eyJhbGciOi'],
    ['connection to postgres://admin:s3cr3t@db.internal:5432/app failed', 's3cr3t'],
    ['SESSION secret = topsecretvalue;', 'topsecretvalue'],
  ])('scrubs %j', (text, secret) => {
    const out = scrubText(text);
    expect(out).not.toContain(secret);
    expect(out).toContain('[REDACTED]');
  });

  it('keeps ordinary text readable', () => {
    expect(scrubText('request completed in 12ms for /api/v1/templates')).toBe(
      'request completed in 12ms for /api/v1/templates',
    );
    expect(scrubText('Unexpected token < in JSON')).toBe('Unexpected token < in JSON');
  });

  it('scrubs secrets inside error messages and stack traces and nested values', () => {
    const err = new Error('db auth failed password=hunter2');
    const out = redact({ err, nested: { msg: 'url postgres://u:pw123@h/db' } });
    expect(JSON.stringify(out)).not.toMatch(/hunter2|pw123/);
  });
});

describe('logger', () => {
  it('writes one JSON line with time, level and msg, and filters by level', () => {
    const lines: string[] = [];
    const log = createLogger({ level: 'warn', write: (l) => lines.push(l) });
    log.info('hidden');
    log.warn('shown', { requestId: 'r1' });
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0] as string);
    expect(rec).toMatchObject({ level: 'warn', msg: 'shown', requestId: 'r1' });
    expect(Date.parse(rec.time)).not.toBeNaN();
  });

  it('redacts fields passed to any level and to child bindings', () => {
    const lines: string[] = [];
    const log = createLogger({ level: 'debug', write: (l) => lines.push(l) }).child({
      apiKey: 'k',
      svc: 'api',
    });
    log.error('failed', { password: 'p', note: 'ok' });
    const rec = JSON.parse(lines[0] as string);
    expect(rec).toMatchObject({ svc: 'api', apiKey: REDACTED, password: REDACTED, note: 'ok' });
  });

  it('callers cannot override reserved fields', () => {
    const lines: string[] = [];
    createLogger({ level: 'debug', write: (l) => lines.push(l) }).info('real', {
      level: 'fake',
      msg: 'fake',
    });
    expect(JSON.parse(lines[0] as string)).toMatchObject({ level: 'info', msg: 'real' });
  });

  it('parses log levels with a fallback', () => {
    expect(parseLogLevel('DEBUG')).toBe('debug');
    expect(parseLogLevel('nonsense')).toBe('info');
    expect(parseLogLevel(undefined, 'warn')).toBe('warn');
  });
});

describe('request logging (TC-9-15)', () => {
  it('logs method, path, status and duration but never the query string or body', async () => {
    const { app, lines, records, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    lines.length = 0;
    await api
      .post('/api/v1/templates?token=SECRETQUERY&email=a@b.com')
      .set('Idempotency-Key', 'log-key-0001')
      .set('Authorization', 'Bearer SECRETHEADER')
      .send({ name: 'Visible only to the app', password: 'SECRETBODY' });

    const text = lines.join('\n');
    expect(text).not.toMatch(/SECRETQUERY|a@b\.com|SECRETHEADER|SECRETBODY|Visible only/);
    const rec = records().find((r) => r.msg === 'request completed');
    expect(rec).toMatchObject({ method: 'POST', path: '/api/v1/templates', status: 400 });
    expect(typeof rec?.durationMs).toBe('number');
  });

  it('uses info for 2xx, warn for 4xx and error for 5xx', async () => {
    const { app, records, authKit } = makeApp();
    const api = await agentAs(app, authKit, 'admin');
    const before = records().length;
    await api.get('/api/v1/templates');
    await api.get('/api/v1/templates/nope');
    const levels = records()
      .slice(before)
      .filter((r) => r.msg === 'request completed')
      .map((r) => r.level);
    expect(levels).toEqual(['info', 'warn']);
  });
});
