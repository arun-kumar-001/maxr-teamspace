import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  basicSettingsSchema,
  companySettingsSchema,
  updateSettingsSchema,
} from './settings.schemas';

const tags = ['Settings'];

registerRoute({
  method: 'get',
  path: '/settings',
  tags,
  summary: 'All company settings (Admin)',
  permission: 'settings.read',
  success: {
    status: 200,
    description: 'Company name, timezone, work week and integration toggles',
    schema: z.object({ data: companySettingsSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/settings/basic',
  tags,
  summary: 'Company name, timezone and work week (every signed-in role)',
  permission: 'settings.read_basic',
  success: {
    status: 200,
    description: 'The part of the settings every module and screen may use',
    schema: z.object({ data: basicSettingsSchema }),
  },
});

registerRoute({
  method: 'put',
  path: '/settings',
  tags,
  summary: 'Change company settings (Admin; send only the fields to change; audited)',
  permission: 'settings.update',
  body: updateSettingsSchema,
  success: {
    status: 200,
    description: 'The settings after the change',
    schema: z.object({ data: companySettingsSchema }),
  },
});
