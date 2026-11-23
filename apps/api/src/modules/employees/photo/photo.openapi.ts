import { idParamSchema } from '@maxr/shared';
import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';

const tags = ['Employees'];

registerRoute({
  method: 'put',
  path: '/employees/me/photo',
  tags,
  summary:
    'Set your own profile photo: the image is the raw request body (PNG or JPEG, up to 2 MB, virus-scanned). It replaces the previous one',
  permission: 'profile.update',
  upload: { contentTypes: ['image/png', 'image/jpeg'] },
  success: {
    status: 200,
    description: 'Where the photo is now served from (the `v` changes with every new photo)',
    schema: z.object({ data: z.object({ photoUrl: z.string() }) }),
  },
});

registerRoute({
  method: 'delete',
  path: '/employees/me/photo',
  tags,
  summary: 'Remove your own profile photo',
  permission: 'profile.update',
  success: { status: 204, description: 'Removed (also when there was none)' },
});

registerRoute({
  method: 'get',
  path: '/employees/{id}/photo',
  tags,
  summary:
    'The profile photo of one employee in your scope, as an image. The URL is stable and needs your session; the browser may cache it for a day because the URL changes when the photo does',
  permission: 'employees.read',
  params: idParamSchema,
  extraResponses: {
    304: 'Unchanged since the ETag you sent',
    404: 'No photo, or not in your scope',
  },
  success: { status: 200, description: 'The image (image/png or image/jpeg)' },
});
