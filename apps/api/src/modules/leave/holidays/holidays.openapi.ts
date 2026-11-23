import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  createHolidaySchema,
  holidayIdParamsSchema,
  holidaySchema,
  listHolidaysQuerySchema,
} from './holidays.schemas';

const tags = ['Leave'];
const one = z.object({ data: holidaySchema });

registerRoute({
  method: 'get',
  path: '/holidays',
  tags,
  summary: 'The holiday calendar of a year (default: the current company year), by date',
  permission: 'holidays.read',
  query: listHolidaysQuerySchema,
  success: {
    status: 200,
    description: 'Holidays of the year',
    schema: z.object({ data: z.array(holidaySchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/holidays',
  tags,
  summary: 'Add a holiday (HR Manager, Admin). Holidays are not counted as leave days',
  permission: 'holidays.manage',
  idempotent: true,
  body: createHolidaySchema,
  extraResponses: { 409: 'That date already has a holiday' },
  success: { status: 201, description: 'The new holiday', schema: one },
});

registerRoute({
  method: 'delete',
  path: '/holidays/{id}',
  tags,
  summary: 'Remove a holiday that has not passed yet (HR Manager, Admin)',
  permission: 'holidays.manage',
  params: holidayIdParamsSchema,
  extraResponses: { 422: 'The holiday has already passed' },
  success: { status: 200, description: 'The removed holiday', schema: one },
});
