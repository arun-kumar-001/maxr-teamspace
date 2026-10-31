# Leave types, policies, balances and the holiday calendar (#38, D-12, D-29)

The set-up half of leave. Applying for leave (#39) and deciding it (#40) build on this.

## API

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /leave-policies` | `leave_policies.read` (everyone) | Every leave type with its policy: `annualDays`, `carryForwardMax`, `allowHalfDay`, `maxBackdateDays`, `hasBalance`, `isActive`, `version`. |
| `POST /leave-policies` | `leave_policies.manage` (HR, Admin) | `Idempotency-Key` required. Adds a type (the code is upper-cased) with its policy. 409 for a repeated code or name. |
| `PUT /leave-policies/{id}` | `leave_policies.manage` | `{id}` is the leave type id. Send the `version` you read; 409 if it changed. Sending nothing different writes nothing. Code and `hasBalance` never change. |
| `GET /holidays?year=` | `holidays.read` (everyone) | Default year: the current company year. |
| `POST /holidays` | `holidays.manage` | `Idempotency-Key` required. One holiday per date (409). |
| `DELETE /holidays/{id}` | `holidays.manage` | Only a holiday that has not passed (today counts as not passed); 422 otherwise. |
| `GET /leave-balances/me?year=` | `leave.read_own` | Your balances, one per leave type that has a balance. |
| `GET /leave-balances` | `leave_balances.list` | Team Lead: direct reports; HR and Admin: everyone. `employeeId`, `year`, `page`, `pageSize`. |
| `POST /leave-balances/accrual` | `leave_balances.accrue` (HR, Admin) | `{ year }`. Creates the missing balances. Safe to repeat. 422 for a year that has not started. |

## Rules (D-29)

- **Policy** (D-12 defaults, seeded): Annual 18 days with carry-forward up to 5, Casual 6, Sick 12 with back-dating up to 7 days, Unpaid with no balance. All day amounts are whole or half days (CHECKs). A type without a balance has no annual days or carry-forward.
- Changing a policy does **not** change balances that already exist; they were allotted under the policy of their year. After adding a type, run the accrual so existing employees get a balance for it.
- **Balance**: one row per employee, leave type and year. `remaining = allotted + carriedForward - used`. The database refuses `used > allotted + carriedForward`, so a balance can never go negative even if a code path forgets to check.
- **Accrual** (`POST /leave-balances/accrual`): for every pending or active employee who joined on or before that year, for every active type with a balance. Full allotment, or pro-rata for someone who joined that year: `annual x (13 - joining month) / 12`, rounded to half days (joining on 15 March gives ten months). Carry-forward is the remaining balance of the year before, up to the policy maximum. Existing rows are never touched. There is no scheduler yet: HR runs it on 1 January (the shared job runner arrives with notifications, #41).
- **New employees** get their balances inside the transaction that creates them (`EmployeeCreationService` calls the leave module's initializer): for the joining year, or the current year when they joined earlier. A failure there undoes the creation.
- **Holidays** are plain calendar dates (no timezone). `HolidayReader.datesBetween(from, to)` is what leave requests and reports use to skip them.
- Known limit: carry-forward is taken when the year is accrued. Leave in the year before that is approved or cancelled later does not change it.

## Data

Migration `20261030000020`: `leave_types`, `leave_policies` (one per type, `version` for compare-and-set), `leave_balances` (`UNIQUE (employee_id, leave_type_id, year)`), `holidays` (`UNIQUE (holiday_date)`), plus the seeded types and policies. RBAC keys in `20261030000021`.
