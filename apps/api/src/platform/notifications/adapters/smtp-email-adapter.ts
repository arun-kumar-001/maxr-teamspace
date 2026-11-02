import nodemailer from 'nodemailer';
import { validateEmailMessage } from '../email-validation';
import { EmailAdapter, EmailDeliveryError, EmailMessage, SentEmailReceipt } from '../types';

/** The one nodemailer method we use, so tests can pass a fake transport. */
export interface MailTransport {
  sendMail(options: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user?: string;
  pass?: string;
}

export function createSmtpTransport(settings: SmtpSettings): MailTransport {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // We never attach files, and this stops message content from pulling in local files or URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export function createSmtpEmailAdapter({
  from,
  transport,
}: {
  from: string;
  transport: MailTransport;
}): EmailAdapter {
  return {
    async send(message: EmailMessage): Promise<SentEmailReceipt> {
      // Defence in depth: validated again here, so a bug upstream cannot inject headers.
      const safe = validateEmailMessage(message);
      try {
        const info = await transport.sendMail({
          from,
          to: safe.to,
          subject: safe.subject,
          text: safe.text,
          html: safe.html,
        });
        return { messageId: info.messageId };
      } catch {
        // The original error can contain server banners or addresses; keep only a generic reason.
        throw new EmailDeliveryError('SMTP delivery failed');
      }
    },
  };
}
