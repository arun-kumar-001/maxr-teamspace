import { ZodObject, ZodRawShape, z } from 'zod';
import { ScopeFilter } from '../rbac';
import { PermissionKey } from '../rbac';
import { CellValue, CsvColumn } from './csv';

export type ReportRow = Record<string, CellValue>;

export interface ReportRunParams<F> {
  filters: F;
  /** Apply inside the query (`scopeToSql`), never to the rows afterwards. */
  scope: ScopeFilter;
  offset: number;
  limit: number;
}

export interface ReportResult {
  rows: ReportRow[];
  /** Rows matching the filters and scope, across all pages. */
  total: number;
}

/**
 * What a module supplies to appear under `GET /reports/{name}`.
 *
 * `columns` is a whitelist: only these keys leave the API, in this order, so sensitive fields
 * (ID documents, bank, compensation) stay out unless a definition lists them on purpose.
 */
export interface ReportDefinition<S extends ZodRawShape = ZodRawShape> {
  /** URL segment, kebab-case: `attendance-summary`. */
  name: string;
  title: string;
  description: string;
  /** The module that owns the data, shown in the catalog. */
  module: string;
  /**
   * The data permissions behind the report. The caller must hold at least one; the widest scope
   * among the ones they hold becomes the `scope` passed to `run`.
   */
  dataPermissions: PermissionKey[];
  /** Query filters beyond paging. Unknown query keys are rejected. */
  filters: ZodObject<S>;
  columns: CsvColumn[];
  run(params: ReportRunParams<z.infer<ZodObject<S>>>): Promise<ReportResult>;
}

export const REPORT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
