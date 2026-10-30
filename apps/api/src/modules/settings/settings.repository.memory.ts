import { ISettingsRepository } from './settings.repository';
import { CompanySettings, UpdateSettingsDto, workDays } from './settings.types';

/** In-memory settings for unit and HTTP tests (not shipped in the build). */
export class MemorySettingsRepository implements ISettingsRepository {
  private settings: CompanySettings = {
    companyName: 'MAXR Teamspace',
    timezone: 'Asia/Kolkata',
    workWeek: { start: 'Monday', end: 'Friday', days: workDays('Monday', 'Friday') },
    integrations: { email: true, sms: false, calendarSync: false, payrollExport: false },
    updatedAt: '2026-10-30T00:00:00.000Z',
  };
  reads = 0;

  async get(): Promise<CompanySettings> {
    this.reads += 1;
    return structuredClone(this.settings);
  }

  async update(dto: UpdateSettingsDto): Promise<CompanySettings> {
    const next = structuredClone(this.settings);
    if (dto.companyName !== undefined) next.companyName = dto.companyName;
    if (dto.timezone !== undefined) next.timezone = dto.timezone;
    if (dto.workWeek !== undefined) {
      next.workWeek = { ...dto.workWeek, days: workDays(dto.workWeek.start, dto.workWeek.end) };
    }
    if (dto.integrations !== undefined) {
      next.integrations = { ...next.integrations, ...dto.integrations };
    }
    next.updatedAt = new Date().toISOString();
    this.settings = next;
    return structuredClone(next);
  }
}
