import { useMemo } from 'react';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Australia/Sydney',
];

export interface TimezoneOption {
  value: string;
  label: string;
}

export function useTimezones(): TimezoneOption[] {
  return useMemo(() => {
    let allZones: string[] = [];

    try {
      if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
        allZones = (
          Intl as unknown as { supportedValuesOf: (key: string) => string[] }
        ).supportedValuesOf('timeZone');
      }
    } catch {
      // Fallback
    }

    if (allZones.length === 0) {
      allZones = COMMON_TIMEZONES;
    }

    // Build unique list with common ones ordered first
    const otherZones = allZones.filter((tz) => !COMMON_TIMEZONES.includes(tz));
    const combined = [...COMMON_TIMEZONES, ...otherZones];

    return combined.map((tz) => ({
      value: tz,
      label: tz.replace(/_/g, ' '),
    }));
  }, []);
}
