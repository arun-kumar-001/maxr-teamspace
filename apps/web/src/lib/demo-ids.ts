/**
 * Employee ids for the development demo (VITE_DEV_MOCK_AUTH=true). They are UUID-shaped like the
 * real ones, so a demo profile link is a valid `/profile/details/<uuid>` and never looks like a
 * guessable `emp-4`. They belong to no real employee and are compiled out of production builds with
 * the rest of the demo data.
 */
export const DEMO_USER_EMPLOYEE_IDS = {
  admin: 'f6c19923-a018-4f26-b41e-59a745da8ddd',
  hr_manager: '1082a44a-f924-410e-ae18-2f52ce584d21',
  team_lead: '53bd329a-1a40-46a9-b46b-77b106e85184',
  staff: '83b4c29a-5c74-42a0-a719-57431cd17d96',
} as const;

/** The six people of the demo employee directory, in directory order. */
export const DEMO_DIRECTORY_EMPLOYEE_IDS = [
  '322b7373-748d-4313-adb1-09a68b8988e7',
  '18c25921-56bd-409c-aaaa-b8186527a9b5',
  '1fe90699-44b5-4ce7-b42d-76eb4dfa924d',
  '8bed24b4-c77b-490e-a5b8-f2cd35c8c190',
  '7c0fdfc2-2309-4fb7-87bc-3323fe82cce8',
  'f6d1afb4-d0a8-4d8e-8fe1-16f2b3eb40d5',
] as const;
