import { describe } from 'vitest';
import { describeCalendarAdapterContract } from '../contracts/calendar-adapter.contract';
import { InMemoryCalendarAdapter } from './in-memory-calendar-adapter';

describe('Calendar Adapter Implementation Suite', () => {
  describeCalendarAdapterContract('in-memory', () => new InMemoryCalendarAdapter());
});
