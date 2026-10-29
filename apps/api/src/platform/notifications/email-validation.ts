import { ApiErrorDetail } from '@maxr/shared';
import { z } from 'zod';
import { validationError } from '../../http/errors';
import { EmailMessage } from './types';

export const MAX_RECIPIENTS = 50;
const NO_LINE_BREAKS = /^[^\r\n]*$/;
// Deliberately simple: no spaces, quotes, angle brackets, commas or line breaks, exactly one "@".
const ADDRESS = /^[^\s@<>"'(),;:\\]+@[^\s@<>"'(),;:\\]+\.[^\s@<>"'(),;:\\]+$/;

const messageSchema = z.object({
  to: z
    .array(z.string().max(254).regex(ADDRESS, 'not a valid email address'))
    .min(1)
    .max(MAX_RECIPIENTS),
  subject: z.string().min(1).max(200).regex(NO_LINE_BREAKS, 'must not contain line breaks'),
  text: z.string().min(1).max(100_000),
  html: z.string().max(200_000).optional(),
});

/** Throws a 400 `VALIDATION_ERROR` (the same envelope the API uses) when a message is unsafe or malformed. */
export function validateEmailMessage(message: EmailMessage): EmailMessage {
  const parsed = messageSchema.safeParse(message);
  if (!parsed.success) {
    const details: ApiErrorDetail[] = parsed.error.issues.slice(0, 10).map((issue) => ({
      field: `email.${issue.path.join('.')}`,
      // Never echo the offending value: it may be a personal address.
      message: issue.message,
      rule: issue.code,
    }));
    throw validationError(details, 'The email message is invalid');
  }
  return parsed.data;
}
