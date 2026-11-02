import { describe, expect, it, vi } from 'vitest';
import { describeEmailAdapterContract } from '../../contracts/email-adapter.contract';
import { EmailDeliveryError } from '../types';
import { FakeEmailAdapter } from './fake-email-adapter';
import { createSendGridEmailAdapter } from './sendgrid-email-adapter';
import { MailTransport, createSmtpEmailAdapter } from './smtp-email-adapter';

const message = {
  to: ['person@example.com', 'second@example.com'],
  subject: 'Leave approved',
  text: 'Plain text',
  html: '<p>Hi</p>',
};

// ---- TC-13-19: the same contract for every adapter --------------------------------------------
describeEmailAdapterContract('fake', () => new FakeEmailAdapter());
describeEmailAdapterContract('smtp (fake transport)', () =>
  createSmtpEmailAdapter({
    from: 'no-reply@maxr.internal',
    transport: { sendMail: async () => ({ messageId: '<abc@maxr>' }) },
  }),
);
describeEmailAdapterContract('sendgrid (fake http)', () =>
  createSendGridEmailAdapter({
    apiKey: 'SG.test-key',
    from: 'no-reply@maxr.internal',
    fetchFn: (async () =>
      new Response(null, { status: 202, headers: { 'x-message-id': 'sg-1' } })) as typeof fetch,
  }),
);

describe('fake email adapter', () => {
  it('records what was sent, as a copy', async () => {
    const adapter = new FakeEmailAdapter();
    const input = { ...message };
    await adapter.send(input);
    input.subject = 'changed later';
    expect(adapter.sent[0]).toMatchObject({ subject: 'Leave approved', to: message.to });
  });

  it('can be told to fail a number of times, then recovers', async () => {
    const adapter = new FakeEmailAdapter();
    adapter.failNext(2, 'down');
    await expect(adapter.send(message)).rejects.toBeInstanceOf(EmailDeliveryError);
    await expect(adapter.send(message)).rejects.toThrow('down');
    await expect(adapter.send(message)).resolves.toBeTruthy();
    expect(adapter.sent).toHaveLength(1);
  });
});

describe('SMTP adapter (TC-13-17)', () => {
  it('passes from, recipients, subject, text and html to the transport', async () => {
    const sendMail = vi.fn<MailTransport['sendMail']>(async () => ({ messageId: '<m1@maxr>' }));
    const adapter = createSmtpEmailAdapter({
      from: 'no-reply@maxr.internal',
      transport: { sendMail },
    });
    const receipt = await adapter.send(message);
    expect(receipt.messageId).toBe('<m1@maxr>');
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@maxr.internal',
      to: message.to,
      subject: 'Leave approved',
      text: 'Plain text',
      html: '<p>Hi</p>',
    });
  });

  it('does not touch the transport at all for an unsafe message (header injection)', async () => {
    const sendMail = vi.fn<MailTransport['sendMail']>();
    const adapter = createSmtpEmailAdapter({
      from: 'no-reply@maxr.internal',
      transport: { sendMail },
    });
    await expect(
      adapter.send({ ...message, subject: 'Hi\r\nBcc: attacker@example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('turns any transport failure into a generic delivery error without server details', async () => {
    const adapter = createSmtpEmailAdapter({
      from: 'no-reply@maxr.internal',
      transport: {
        sendMail: async () => {
          throw new Error('550 5.1.1 person@example.com rejected by smtp.internal.corp (10.0.0.5)');
        },
      },
    });
    const error = await adapter.send(message).catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('SMTP delivery failed');
  });
});

describe('SendGrid adapter (TC-13-18)', () => {
  const API_KEY = 'SG.super-secret-key-123';
  const make = (fetchFn: typeof fetch, extra: object = {}) =>
    createSendGridEmailAdapter({
      apiKey: API_KEY,
      from: 'no-reply@maxr.internal',
      fetchFn,
      ...extra,
    });

  it('sends the right HTTPS request', async () => {
    const fetchFn = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(null, { status: 202, headers: { 'x-message-id': 'sg-42' } }),
    );
    const receipt = await make(fetchFn as unknown as typeof fetch).send(message);
    expect(receipt.messageId).toBe('sg-42');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      personalizations: [
        { to: [{ email: 'person@example.com' }, { email: 'second@example.com' }] },
      ],
      from: { email: 'no-reply@maxr.internal' },
      subject: 'Leave approved',
      content: [
        { type: 'text/plain', value: 'Plain text' },
        { type: 'text/html', value: '<p>Hi</p>' },
      ],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('a non-2xx answer is an error that has the status but not the key or the response body', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          errors: [{ message: `bad address person@example.com for key ${API_KEY}` }],
        }),
        { status: 400 },
      )) as typeof fetch;
    const error = await make(fetchFn)
      .send(message)
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('SendGrid responded with HTTP 400');
    expect(JSON.stringify(error)).not.toMatch(/person@example|SG\.super/);
  });

  it('a network failure or timeout is a generic error that does not leak the key', async () => {
    const fetchFn = (async () => {
      throw new Error(`getaddrinfo ENOTFOUND api.sendgrid.com Authorization: Bearer ${API_KEY}`);
    }) as typeof fetch;
    const error = await make(fetchFn)
      .send(message)
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).not.toContain('SG.');
  });

  it('really times out a hung request', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const started = Date.now();
    await expect(make(hang, { timeoutMs: 50 }).send(message)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('falls back to a generated message id when SendGrid sends none', async () => {
    const fetchFn = (async () => new Response(null, { status: 202 })) as typeof fetch;
    expect((await make(fetchFn).send(message)).messageId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
