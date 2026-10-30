import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { RequestContext } from '../employees/types';
import { CachedCompanySettingsReader } from './settings.reader';
import { ISettingsRepository } from './settings.repository';
import { BasicSettings, CompanySettings, UpdateSettingsDto } from './settings.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export class SettingsService {
  constructor(
    private readonly repository: ISettingsRepository,
    private readonly reader: CachedCompanySettingsReader,
    private readonly platform: Deps,
  ) {}

  get(): Promise<CompanySettings> {
    return this.repository.get();
  }

  getBasic(): Promise<BasicSettings> {
    return this.reader.getBasic();
  }

  async update(dto: UpdateSettingsDto, ctx: RequestContext): Promise<CompanySettings> {
    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();
    try {
      const updated = await this.repository.update(dto);
      // The change is committed: drop the cached copy before anything else can read it.
      this.reader.invalidate();
      // Field names only: values (company name, toggles) are not needed in the audit trail.
      await audit.record({
        action: 'settings.update',
        outcome: 'success',
        entityType: 'company_settings',
        changes: { fields: Object.keys(dto) },
      });
      events.add({
        type: 'settings.updated',
        payload: { fields: Object.keys(dto) },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });
      await events.flush(this.platform.events);
      return updated;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'settings.update',
        outcome: 'failure',
        entityType: 'company_settings',
      });
      throw err;
    }
  }
}
