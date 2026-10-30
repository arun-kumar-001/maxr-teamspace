import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import { reportNameParam } from './report.routes';

const tags = ['Reports'];

const Column = z.object({ key: z.string(), label: z.string() });
const Summary = z
  .object({
    name: z.string().meta({ example: 'attendance-summary' }),
    title: z.string(),
    description: z.string(),
    module: z.string(),
    columns: z.array(Column),
  })
  .meta({ id: 'ReportSummary' });

registerRoute({
  method: 'get',
  path: '/reports',
  tags,
  summary: 'Reports the caller may run',
  permission: 'reports.read',
  success: {
    status: 200,
    description: "The catalog for the caller's role",
    schema: z.object({ data: z.array(Summary) }),
  },
});

registerRoute({
  method: 'get',
  path: '/reports/{name}',
  tags,
  summary:
    'Preview a report (paginated). Filters differ per report; unknown query keys are rejected',
  permission: 'reports.read',
  params: reportNameParam,
  query: z.object({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }),
  extraResponses: { 404: "Unknown report, or one outside the caller's role" },
  success: {
    status: 200,
    description: "A page of rows limited to the declared columns and the caller's record scope",
    schema: z.object({
      data: z.array(z.record(z.string(), z.unknown())),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'get',
  path: '/reports/{name}/export',
  tags,
  summary: 'Download a report as CSV (audited; at most 10,000 rows)',
  permission: 'reports.export',
  params: reportNameParam,
  query: z.object({ format: z.enum(['csv']).optional() }),
  extraResponses: {
    404: "Unknown report, or one outside the caller's role",
    422: 'More than 10,000 rows: narrow the filters',
  },
  success: { status: 200, description: 'CSV file (UTF-8 with BOM)' },
});
