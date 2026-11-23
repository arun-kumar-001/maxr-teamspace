import { notFound, unprocessable } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import type { CompanySettingsReader } from '../../settings';
import { IHolidaysRepository } from './holidays.repository';
import type { CreateHolidayInput } from './holidays.schemas';
import { Holiday, HolidayReader } from './holidays.types';

type Deps = Pick<PlatformServices, 'audit'>;

export interface HolidayCaller {
  actorId: string;
  requestId?: string;
}

export class HolidaysService implements HolidayReader {
  constructor(
    private readonly repository: IHolidaysRepository,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** `YYYY-MM-DD` of today on the company clock. */
  private async today(): Promise<string> {
    const { timezone } = await this.settings.getBasic();
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(this.clock());
  }

  async list(year: number | undefined): Promise<Holiday[]> {
    return this.repository.listYear(year ?? Number((await this.today()).slice(0, 4)));
  }

  datesBetween(from: string, to: string): Promise<string[]> {
    return this.repository.datesBetween(from, to);
  }

  async create(input: CreateHolidayInput, caller: HolidayCaller): Promise<Holiday> {
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const created = await this.repository.insert(tx, input.date, input.name);
      await audit.record(
        {
          action: 'holiday.create',
          outcome: 'success',
          entityType: 'holiday',
          entityId: created.id,
          changes: { date: created.date, name: created.name },
        },
        { transaction: tx },
      );
      return created;
    });
  }

  /**
   * A holiday that has already passed stays: leave counted on it was worked out with it, and
   * removing it would silently change what those requests meant.
   */
  async remove(id: string, caller: HolidayCaller): Promise<Holiday> {
    const today = await this.today();
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const holiday = await this.repository.findForUpdate(tx, id);
      if (!holiday) throw notFound('Holiday not found');
      if (holiday.date < today) throw unprocessable('A holiday that has passed cannot be removed');
      await this.repository.remove(tx, id);
      await audit.record(
        {
          action: 'holiday.delete',
          outcome: 'success',
          entityType: 'holiday',
          entityId: id,
          changes: { date: holiday.date, name: holiday.name },
        },
        { transaction: tx },
      );
      return holiday;
    });
  }
}
