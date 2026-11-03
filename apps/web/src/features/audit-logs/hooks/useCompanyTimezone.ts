import { useState, useEffect } from 'react';
import { getBasicSettings } from '../api/auditLogsApi';

let cachedTimezone: string | null = null;

export function useCompanyTimezone(): {
  timezone: string;
  isLoading: boolean;
} {
  const [timezone, setTimezone] = useState<string>(
    cachedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [isLoading, setIsLoading] = useState<boolean>(!cachedTimezone);

  useEffect(() => {
    let mounted = true;

    if (cachedTimezone) {
      return;
    }

    getBasicSettings()
      .then((settings) => {
        if (!mounted) return;
        if (settings?.timezone) {
          cachedTimezone = settings.timezone;
          setTimezone(settings.timezone);
        }
      })
      .catch(() => {
        // Fallback to local system timezone
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { timezone, isLoading };
}

/**
 * Format an ISO UTC timestamp in a specific IANA timezone.
 */
export function formatInTimezone(
  isoString: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...options,
    };
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch {
    return isoString;
  }
}
