# Company settings

Issue #30 (backend half). One settings row for the whole company; the Admin pages (UI half) come after the app shell work.

## API

| Route                        | Permission            | Who                  | Result                                                 |
| ---------------------------- | --------------------- | -------------------- | ------------------------------------------------------ |
| `GET /api/v1/settings`       | `settings.read`       | Admin                | Company name, timezone, work week, integration toggles |
| `GET /api/v1/settings/basic` | `settings.read_basic` | every signed-in role | Company name, timezone, work week only                 |
| `PUT /api/v1/settings`       | `settings.update`     | Admin                | The settings after the change                          |

`PUT` takes only the fields to change (unknown fields are rejected): `companyName`, `timezone` (IANA, `UTC` or `Area/City`; abbreviations such as `IST` are refused as ambiguous), `workWeek` (`{ start, end }` as day names; start and end must differ and may wrap, for example Sunday to Thursday) and `integrations` (partial: `email`, `sms`, `calendarSync`, `payrollExport`; toggles not mentioned keep their value). Every change is audited (`settings.update`, field names only) and announces a `settings.updated` event.

## Reading settings from another module

Do not read the table. Depend on `CompanySettingsReader` (`modules/settings`): `getBasic()` returns `{ companyName, timezone, workWeek: { start, end, days } }`.

```ts
const { timezone } = await settings.getBasic();
const workDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // 2026-10-30
```

The reader keeps a 60 second in-process cache. A change made through the API shows up on that instance at once (the update invalidates the cache); other API instances see it within 60 seconds.

`createSettings({ platform, authenticate })` returns `{ router, reader }`; the composition root passes `reader` to the routers that need it (attendance, leave, reports).

## Data

Table `company_settings` (migration `20261030000008`): one row with the fixed id `00000000-0000-0000-0000-000000000001`, created by the migration (production defaults per D-13: `Asia/Kolkata`, Monday to Friday), kept the only row by a CHECK, with CHECKs on the work-week day names. `integrations` is a JSONB object of booleans. All timestamps elsewhere are stored in UTC and shown in this timezone.

## Not included on purpose

**Security settings** (session lengths, lockout, password rules) are fixed by ADR D-05 and live in configuration. A setting that changes nothing would be misleading, and making them editable means the auth module reading them at runtime, which is a security decision for the TL. Add it with its own decision when needed.
