import { describe, expect, it } from 'vitest';
import { EmailAdapter } from '../notifications/types';

/**
 * Behaviour every email adapter must have. `create` returns an adapter wired to a harmless
 * fake transport/HTTP client, so no real mail is sent.
 */
export function describeEmailAdapterContract(name: string, create: () => EmailAdapter): void {
  describe(`email adapter contract: ${name}`, () => {
    const valid = {
      to: ['person@example.com'],
      subject: 'Leave approved',
      text: 'Your leave was approved.',
    };

    it('sends a valid message and returns a message id', async () => {
      const receipt = await create().send(valid);
      expect(typeof receipt.messageId).toBe('string');
      expect(receipt.messageId.length).toBeGreaterThan(0);
    });

    it.each([
      ['a line break in the subject', { ...valid, subject: 'Hi\r\nBcc: attacker@example.com' }],
      ['a line break in an address', { ...valid, to: ['a@example.com\r\nBcc: x@example.com'] }],
      ['a malformed address', { ...valid, to: ['not-an-email'] }],
      ['two addresses in one string', { ...valid, to: ['a@example.com, b@example.com'] }],
      ['no recipients', { ...valid, to: [] }],
      [
        'more than 50 recipients',
        { ...valid, to: Array.from({ length: 51 }, (_, i) => `u${i}@example.com`) },
      ],
      ['an empty subject', { ...valid, subject: '' }],
      ['an oversize body', { ...valid, text: 'x'.repeat(100_001) }],
    ])('refuses %s and sends nothing', async (_label, message) => {
      await expect(create().send(message)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('does not repeat the offending value in the error', async () => {
      const error = await create()
        .send({ ...valid, to: ['secret.person@@example.com'] })
        .catch((e: Error) => e);
      expect(JSON.stringify(error)).not.toContain('secret.person');
      expect((error as Error).message).not.toContain('secret.person');
    });
  });
}
