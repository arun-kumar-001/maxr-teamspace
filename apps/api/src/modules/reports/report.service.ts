import { PaginatedResponse, Role, ApiErrorDetail } from '@maxr/shared';
import { ZodObject, ZodRawShape, z } from 'zod';
import { notFound, unprocessable, validationError } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { AuditLogger } from '../../platform';
import { ScopeFilter, resolveScope, toScopeFilter, widestScope } from '../rbac';
import { toCsv } from './csv';
import { ReportDefinition, ReportRow } from './report-definition';
import { ReportRegistry } from './report-registry';

/** Hard ceiling for one export. Larger exports need narrower filters (async exports come later). */
export const MAX_EXPORT_ROWS = 10_000;

export interface ReportActor {
  id: string;
  employeeId: string;
  roles: Role[];
}

export interface ReportContext {
  actor: ReportActor;
  requestId?: string;
}

export interface ReportSummary {
  name: string;
  title: string;
  description: string;
  module: string;
  columns: Array<{ key: string; label: string }>;
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

const previewPaging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const exportOptions = z.object({ format: z.enum(['csv']).default('csv') });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDefinition = ReportDefinition<any>;

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details: ApiErrorDetail[] = result.error.issues.slice(0, 20).map((issue) => ({
      field: ['query', ...issue.path].join('.'),
      message: issue.message.slice(0, 200),
      rule: issue.code,
    }));
    throw validationError(details);
  }
  return result.data;
}

/** Only the declared columns leave the API, in the preview as in the export. */
function project(def: AnyDefinition, rows: ReportRow[]): ReportRow[] {
  return rows.map((row) => Object.fromEntries(def.columns.map((c) => [c.key, row[c.key] ?? null])));
}

export class ReportService {
  constructor(
    private readonly registry: ReportRegistry,
    private readonly audit: AuditLogger,
  ) {}

  /** The widest scope the caller's roles give them over a report's data; null when they hold none. */
  private scopeFor(def: AnyDefinition, actor: ReportActor): ScopeFilter | null {
    const widest = widestScope(def.dataPermissions.map((p) => resolveScope(actor.roles, p)));
    return widest ? toScopeFilter(widest, actor) : null;
  }

  /** Out of the caller's reach looks exactly like an unknown report. */
  private resolve(name: string, actor: ReportActor): { def: AnyDefinition; scope: ScopeFilter } {
    const def = this.registry.get(name);
    const scope = def ? this.scopeFor(def, actor) : null;
    if (!def || !scope) {
      throw notFound('Report not found');
    }
    return { def, scope };
  }

  list(actor: ReportActor): ReportSummary[] {
    return this.registry
      .all()
      .filter((def) => this.scopeFor(def, actor) !== null)
      .map(({ name, title, description, module, columns }) => ({
        name,
        title,
        description,
        module,
        columns,
      }));
  }

  async preview(
    name: string,
    query: unknown,
    ctx: ReportContext,
  ): Promise<PaginatedResponse<ReportRow>> {
    const { def, scope } = this.resolve(name, ctx.actor);
    const parsed = parse(
      previewPaging.extend((def.filters as ZodObject<ZodRawShape>).shape).strict(),
      query,
    );
    const { page, pageSize, ...filters } = parsed as { page: number; pageSize: number };
    const { rows, total } = await def.run({
      filters: filters as never,
      scope,
      ...toOffsetLimit({ page, pageSize }),
    });
    return buildPage(project(def, rows), total, { page, pageSize });
  }

  async export(name: string, query: unknown, ctx: ReportContext): Promise<ExportFile> {
    const { def, scope } = this.resolve(name, ctx.actor);
    const parsed = parse(
      exportOptions.extend((def.filters as ZodObject<ZodRawShape>).shape).strict(),
      query,
    );
    const { format, ...filters } = parsed as { format: 'csv' };
    const audit = this.audit.withContext({
      actorId: ctx.actor.id,
      actorRole: ctx.actor.roles[0],
      requestId: ctx.requestId,
    });

    // One extra row tells "exactly at the limit" from "over it" without counting twice.
    const { rows } = await def.run({
      filters: filters as never,
      scope,
      offset: 0,
      limit: MAX_EXPORT_ROWS + 1,
    });
    if (rows.length > MAX_EXPORT_ROWS) {
      await audit.tryRecord({
        action: 'report.export',
        outcome: 'failure',
        entityType: 'report',
        entityId: def.name,
        metadata: { format, reason: 'too_many_rows', limit: MAX_EXPORT_ROWS },
      });
      throw unprocessable(
        `This export has more than ${MAX_EXPORT_ROWS} rows. Narrow the filters and try again.`,
      );
    }

    const body = toCsv(def.columns, rows);
    // Audit before delivery and fail closed: no audit entry, no file. Filter names only, not values.
    await audit.record({
      action: 'report.export',
      outcome: 'success',
      entityType: 'report',
      entityId: def.name,
      metadata: { format, rows: rows.length, filters: Object.keys(filters) },
    });
    return {
      filename: `${def.name}-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body,
    };
  }
}
