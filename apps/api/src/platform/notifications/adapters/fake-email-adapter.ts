import { randomUUID } from 'crypto';
import { validateEmailMessage } from '../email-validation';
import { EmailAdapter, EmailDeliveryError, EmailMessage, SentEmailReceipt } from '../types';

/** Records messages instead of sending them. Can be told to fail, to test retries. */
export class FakeEmailAdapter implements EmailAdapter {
  readonly sent: Array<EmailMessage & { messageId: string }> = [];
  private failuresLeft = 0;
  private failureMessage = 'fake delivery failure';

  /** The next `times` sends throw `EmailDeliveryError(message)`. */
  failNext(times = 1, message = 'fake delivery failure'): void {
    this.failuresLeft = times;
    this.failureMessage = message;
  }

  async send(message: EmailMessage): Promise<SentEmailReceipt> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new EmailDeliveryError(this.failureMessage);
    }
    // Validates like the real adapters, so tests using the fake catch unsafe messages too.
    const safe = validateEmailMessage(message);
    const messageId = randomUUID();
    this.sent.push({ ...structuredClone(safe), messageId });
    return { messageId };
  }
}
