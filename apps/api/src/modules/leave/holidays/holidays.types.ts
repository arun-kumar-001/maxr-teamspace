export interface Holiday {
  id: string;
  /** `YYYY-MM-DD`, a calendar date with no timezone. */
  date: string;
  name: string;
}

/** What leave and reports depend on: the holiday dates, never the table. */
export interface HolidayReader {
  /** Holiday dates from `from` to `to`, both inclusive, as `YYYY-MM-DD`, ascending. */
  datesBetween(from: string, to: string): Promise<string[]>;
}
