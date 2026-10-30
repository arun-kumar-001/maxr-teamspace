import { registerRoute } from '../../openapi/registry';
import { changePasswordSchema, loginSchema, sessionResponseSchema } from './auth.schemas';

const tags = ['Auth'];

registerRoute({
  method: 'post',
  path: '/auth/login',
  tags,
  summary: 'Sign in with email and password',
  access: 'Public',
  body: loginSchema,
  extraResponses: {
    429: 'Too many failed attempts for this account or from this address (see Retry-After)',
  },
  success: {
    status: 200,
    description:
      'Signed in. Sets the httpOnly `maxr_session` cookie and returns the profile and CSRF token.',
    schema: sessionResponseSchema,
  },
});

registerRoute({
  method: 'get',
  path: '/auth/me',
  tags,
  summary: 'The signed-in user, their role and permissions, and the CSRF token',
  access: 'Any signed-in user',
  success: { status: 200, description: 'The current session', schema: sessionResponseSchema },
});

registerRoute({
  method: 'post',
  path: '/auth/logout',
  tags,
  summary: 'End the current session',
  permission: 'auth.logout',
  success: { status: 204, description: 'Signed out; the cookie is cleared' },
});

registerRoute({
  method: 'post',
  path: '/auth/change-password',
  tags,
  summary: 'Change the password; all other sessions of the user end',
  access: 'Any signed-in user',
  body: changePasswordSchema,
  extraResponses: {
    403: 'The current password is wrong',
    422: 'The new password does not meet the rules',
  },
  success: { status: 204, description: 'Password changed' },
});
