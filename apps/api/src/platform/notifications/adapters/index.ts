import { PlatformConfig } from '../../platform-config';
import { EmailAdapter } from '../types';
import { FakeEmailAdapter } from './fake-email-adapter';
import { createSendGridEmailAdapter } from './sendgrid-email-adapter';
import { createSmtpEmailAdapter, createSmtpTransport } from './smtp-email-adapter';

export function createEmailAdapter(config: PlatformConfig['email']): EmailAdapter {
  switch (config.driver) {
    case 'fake':
      return new FakeEmailAdapter();
    case 'sendgrid':
      return createSendGridEmailAdapter({
        apiKey: config.sendgridApiKey as string,
        from: config.from,
      });
    case 'smtp':
      return createSmtpEmailAdapter({
        from: config.from,
        transport: createSmtpTransport(config.smtp),
      });
  }
}
