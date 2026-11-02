import http from 'http';
import net from 'net';
import { AddressInfo } from 'net';
import { describe, expect, it } from 'vitest';
import { EmailDeliveryError } from '../types';
import { createSendGridEmailAdapter } from './sendgrid-email-adapter';
import { createSmtpEmailAdapter, createSmtpTransport } from './smtp-email-adapter';

// These tests use REAL sockets on 127.0.0.1 (no external network): a tiny SMTP receiver and an
// HTTP server, so we see exactly what nodemailer and fetch put on the wire.

interface SmtpSink {
  port: number;
  /** Raw DATA section of every accepted message. */
  messages: string[];
  /** RCPT TO lines, i.e. the real envelope recipients. */
  recipients: string[];
  close(): Promise<void>;
}

async function startSmtpSink(): Promise<SmtpSink> {
  const messages: string[] = [];
  const recipients: string[] = [];
  const server = net.createServer((socket) => {
    socket.write('220 sink ESMTP\r\n');
    let buffer = '';
    let data = '';
    let inData = false;
    socket.on('error', () => undefined);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(data);
            data = '';
            socket.write('250 OK queued\r\n');
          } else {
            data += `${line}\n`;
          }
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-sink\r\n250 8BITMIME\r\n');
        else if (command === 'RCPT') {
          recipients.push(line);
          socket.write('250 OK\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 go ahead\r\n');
        } else if (command === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    messages,
    recipients,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const message = {
  to: ['asha@example.com', 'ravi@example.com'],
  subject: 'Leave approved',
  text: 'Your leave was approved.',
  html: '<p>Your leave was approved.</p>',
};

describe('SMTP adapter over a real socket (TC-13-17)', () => {
  it('delivers the message with the right headers, recipients and both bodies', async () => {
    const sink = await startSmtpSink();
    try {
      const adapter = createSmtpEmailAdapter({
        from: 'no-reply@maxr.internal',
        transport: createSmtpTransport({ host: '127.0.0.1', port: sink.port }),
      });
      const receipt = await adapter.send(message);
      expect(receipt.messageId).toBeTruthy();

      expect(sink.recipients.map((r) => r.toLowerCase())).toEqual([
        'rcpt to:<asha@example.com>',
        'rcpt to:<ravi@example.com>',
      ]);
      const [raw] = sink.messages;
      expect(raw).toMatch(/^From: no-reply@maxr\.internal$/m);
      expect(raw).toMatch(/^To: .*asha@example\.com.*ravi@example\.com/m);
      expect(raw).toMatch(/^Subject: Leave approved$/m);
      expect(raw).toContain('Your leave was approved.');
      expect(raw).toContain('<p>Your leave was approved.</p>');
      expect(raw).not.toMatch(/^Bcc:/im);
    } finally {
      await sink.close();
    }
  });

  it('an injection attempt never reaches the network', async () => {
    const sink = await startSmtpSink();
    try {
      const adapter = createSmtpEmailAdapter({
        from: 'no-reply@maxr.internal',
        transport: createSmtpTransport({ host: '127.0.0.1', port: sink.port }),
      });
      await expect(
        adapter.send({ ...message, subject: 'Hi\r\nBcc: attacker@example.com' }),
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        adapter.send({ ...message, to: ['asha@example.com\r\nRCPT TO:<attacker@example.com>'] }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(sink.messages).toHaveLength(0);
      expect(sink.recipients).toHaveLength(0);
    } finally {
      await sink.close();
    }
  });

  it('a mail server that is down gives a quick, generic delivery error', async () => {
    const sink = await startSmtpSink();
    const { port } = sink;
    await sink.close(); // nothing listens on this port any more
    const adapter = createSmtpEmailAdapter({
      from: 'no-reply@maxr.internal',
      transport: createSmtpTransport({ host: '127.0.0.1', port }),
    });
    const started = Date.now();
    const error = await adapter.send(message).catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('SMTP delivery failed');
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('SendGrid adapter over real HTTP (TC-13-18)', () => {
  async function startApi(
    handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void,
  ) {
    const requests: Array<{
      method?: string;
      url?: string;
      headers: http.IncomingHttpHeaders;
      body: string;
    }> = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        requests.push({ method: req.method, url: req.url, headers: req.headers, body });
        handler(req, body, res);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return {
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      requests,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }

  it('sends the documented request and returns SendGrid’s message id', async () => {
    const api = await startApi((_req, _body, res) => {
      res.writeHead(202, { 'x-message-id': 'sg-real-1' });
      res.end();
    });
    try {
      const adapter = createSendGridEmailAdapter({
        apiKey: 'SG.real-key',
        from: 'no-reply@maxr.internal',
        baseUrl: api.baseUrl,
      });
      expect((await adapter.send(message)).messageId).toBe('sg-real-1');
      const [request] = api.requests;
      expect(request).toMatchObject({ method: 'POST', url: '/v3/mail/send' });
      expect(request?.headers.authorization).toBe('Bearer SG.real-key');
      expect(request?.headers['content-type']).toBe('application/json');
      const body = JSON.parse(request?.body ?? '{}');
      expect(body.personalizations[0].to).toEqual([
        { email: 'asha@example.com' },
        { email: 'ravi@example.com' },
      ]);
      expect(body.subject).toBe('Leave approved');
    } finally {
      await api.close();
    }
  });

  it('a rejected key (401) is a generic error that never contains the key or the response', async () => {
    const api = await startApi((_req, _body, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          errors: [
            {
              message: 'The provided authorization grant is invalid: SG.real-key asha@example.com',
            },
          ],
        }),
      );
    });
    try {
      const adapter = createSendGridEmailAdapter({
        apiKey: 'SG.real-key',
        from: 'no-reply@maxr.internal',
        baseUrl: api.baseUrl,
      });
      const error = await adapter.send(message).catch((e: Error) => e);
      expect((error as Error).message).toBe('SendGrid responded with HTTP 401');
      expect(JSON.stringify(error)).not.toMatch(/SG\.real|asha@/);
    } finally {
      await api.close();
    }
  });

  it('a server that never answers is cut off by the timeout', async () => {
    const api = await startApi(() => undefined); // never responds
    try {
      const adapter = createSendGridEmailAdapter({
        apiKey: 'SG.k',
        from: 'no-reply@maxr.internal',
        baseUrl: api.baseUrl,
        timeoutMs: 100,
      });
      const started = Date.now();
      await expect(adapter.send(message)).rejects.toBeInstanceOf(EmailDeliveryError);
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      await api.close();
    }
  });
});
