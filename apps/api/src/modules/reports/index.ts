import { RequestHandler, Router } from 'express';
import type { AuditLogger } from '../../platform';
import { ReportRegistry } from './report-registry';
import { createReportsRouter } from './report.routes';
import { ReportService } from './report.service';

export { ReportRegistry } from './report-registry';
export type { ReportDefinition, ReportResult, ReportRunParams } from './report-definition';

export interface ReportsServices {
  /** Mount at /api/v1/reports. */
  router: Router;
  /** Modules call `registry.register(definition)` when the app is composed. */
  registry: ReportRegistry;
}

export function createReports(options: {
  audit: AuditLogger;
  authenticate: RequestHandler;
  registry?: ReportRegistry;
}): ReportsServices {
  const registry = options.registry ?? new ReportRegistry();
  const service = new ReportService(registry, options.audit);
  return { router: createReportsRouter(service, options.authenticate), registry };
}
