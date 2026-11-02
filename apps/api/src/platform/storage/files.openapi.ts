import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';

registerRoute({
  method: 'get',
  path: '/files/download',
  tags: ['Files'],
  summary: 'Download a file with a signed, short-lived link',
  access: 'Signed link, issued after the module authorization check',
  query: z.object({ token: z.string().min(1).max(2048) }),
  extraResponses: {
    404: 'Unknown, tampered or not-for-you link (all look the same)',
    410: 'The link has expired',
  },
  success: {
    status: 200,
    description: 'The file, always as an attachment (Content-Disposition: attachment)',
  },
});
