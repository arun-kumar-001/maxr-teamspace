import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers';
import { createLogger, parseLogLevel } from './logger';
import { REDACTED, isSensitiveKey, redact } from './redact';

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
    }) as Record<string, any>;

    expect(out.user.name).toBe('Asha');
    expect(out.user.Password).toBe(REDACTED);
    expect(out.user.password_hash).toBe(REDACTED);
    expect(out.user.profile.bankAccount).toBe(REDACTED);
    expect(out.user.profile.iban).toBe(REDACTED);
    expect(out.list[0].token).toBe(REDACTED);
    expect(out.list[1].accessToken).toBe(REDACTED);
    expect(out.headers).toEqual({
      Authorization: REDACTED,
      'set-cookie': REDACTED,
      cookie: REDACTED,
    });
    expect(out.salary).toBe(REDACTED);
    expect(out.ssn).toBe(REDACTED);
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
    }) as Record<string, any>;
    expect(out.a.self).toBe('[Circular]');
    expect(out.when).toBe('2026-01-02T03:04:05.000Z');
    expect(out.big).toBe('10');
    expect(out.err.message).toBe('boom');
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(JSON.stringify(redact(deep))).toContain('[MaxDepth]');
  });

  it('truncates very long strings', () => {
    expect((redact('x'.repeat(5000)) as string).length).toBeLessThan(2100);
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
    const { app, lines, records } = makeApp();
    await request(app)
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
    const { app, records } = makeApp();
    await request(app).get('/api/v1/templates');
    await request(app).get('/api/v1/templates/nope');
    const levels = records()
      .filter((r) => r.msg === 'request completed')
      .map((r) => r.level);
    expect(levels).toEqual(['info', 'warn']);
  });
});
