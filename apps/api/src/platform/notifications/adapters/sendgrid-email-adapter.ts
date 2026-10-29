import { randomUUID } from 'crypto';
import { validateEmailMessage } from '../email-validation';
import { EmailAdapter, EmailDeliveryError, EmailMessage, SentEmailReceipt } from '../types';

export interface SendGridOptions {
  apiKey: string;
  from: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

/** Sends through SendGrid's HTTPS API. Error messages never include the API key or the response body. */
export function createSendGridEmailAdapter({
  apiKey,
  from,
  fetchFn = fetch,
  timeoutMs = 10_000,
  baseUrl = 'https://api.sendgrid.com',
}: SendGridOptions): EmailAdapter {
  return {
    async send(message: EmailMessage): Promise<SentEmailReceipt> {
      const safe = validateEmailMessage(message);
      const content = [{ type: 'text/plain', value: safe.text }];
      if (safe.html) {
        content.push({ type: 'text/html', value: safe.html });
      }

      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/v3/mail/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: safe.to.map((email) => ({ email })) }],
            from: { email: from },
            subject: safe.subject,
            content,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new EmailDeliveryError('SendGrid request failed or timed out');
      }

      if (!response.ok) {
        throw new EmailDeliveryError(`SendGrid responded with HTTP ${response.status}`);
      }
      return { messageId: response.headers.get('x-message-id') ?? randomUUID() };
    },
  };
}
