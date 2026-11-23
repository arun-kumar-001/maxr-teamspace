/**
 * Sample data is for local development only. A production build must show what the server returned
 * (or an honest empty/error state), never invented records. The flag is opt-in and compiled out of
 * production builds because `import.meta.env.DEV` is false there.
 */
export const isDemoDataEnabled = (): boolean =>
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_MOCK_AUTH === 'true' &&
  import.meta.env.MODE !== 'test';

/** Returns the sample data only when demo data is enabled, otherwise the real (possibly empty) value. */
export const demoOr = <T>(real: T, sample: T): T => (isDemoDataEnabled() ? sample : real);
