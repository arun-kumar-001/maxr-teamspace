import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import type { PlatformServices } from '../../platform';
import { CachedCompanySettingsReader, CompanySettingsReader } from './settings.reader';
import { ISettingsRepository, PgSettingsRepository } from './settings.repository';
import { createSettingsRouter } from './settings.routes';
import { SettingsService } from './settings.service';

export type { CompanySettingsReader } from './settings.reader';
export type { BasicSettings, DayName, WorkWeek } from './settings.types';

export interface SettingsServices {
  /** Mount at /api/v1/settings. */
  router: Router;
  /** Give this to modules that need the company timezone or work week. */
  reader: CompanySettingsReader;
}

export function createSettings(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: ISettingsRepository;
  getPool?: () => Pool;
}): SettingsServices {
  const repository = options.repository ?? new PgSettingsRepository(options.getPool ?? getPool);
  const reader = new CachedCompanySettingsReader(repository);
  const service = new SettingsService(repository, reader, options.platform);
  return { router: createSettingsRouter(service, options.authenticate), reader };
}
