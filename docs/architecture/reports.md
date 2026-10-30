# Reports framework

Issue #15. Modules supply report definitions; the framework supplies the routes, authorization, scope, validation, CSV export and audit.

## Routes

| Route                               | Permission       | Result                                                                 |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `GET /api/v1/reports`               | `reports.read`   | Reports the caller's role can run (name, title, columns)               |
| `GET /api/v1/reports/{name}`        | `reports.read`   | Paginated JSON preview (`page`, `pageSize`, plus the report's filters) |
| `GET /api/v1/reports/{name}/export` | `reports.export` | CSV download (`format=csv`, plus the same filters), audited            |

Admin and HR Manager reach reports with company scope, Team Lead with team scope (D-27), Staff not at all.

## Writing a report

```ts
registry.register({
  name: 'attendance-summary', // kebab-case URL segment
  title: 'Attendance summary',
  description: 'Days present, late and absent per employee',
  module: 'attendance',
  dataPermissions: ['attendance.read_all', 'attendance.read_team'],
  filters: z.object({ from: isoDate, to: isoDate, departmentId: z.string().uuid().optional() }),
  columns: [{ key: 'employeeName', label: 'Employee' } /* ... */],
  async run({ filters, scope, offset, limit }) {
    const where = scopeToSql(scope, 'a.employee_id', 1); // scope inside the query
    // SELECT ... WHERE ${where.clause} ... LIMIT/OFFSET -> { rows, total }
  },
});
```

- **Data permissions:** the caller must hold at least one; the widest scope among those they hold is passed to `run`. A report outside the role answers 404, the same as an unknown name.
- **Filters:** a strict Zod object. Unknown query keys and bad values are 400.
- **Columns are a whitelist** for both preview and export. Extra fields on a row never leave the API. Sensitive fields (ID documents, bank, compensation) only appear if a definition lists them on purpose and the caller holds that permission.
- **Registration:** the app composition passes a `ReportRegistry` (`createApp({ reportRegistry })`); modules call `register` there. The registry rejects bad names, duplicates, no permission and no columns.

## CSV

RFC 4180, CRLF, UTF-8 with a byte order mark so Excel reads it. Text cells starting with `=`, `+`, `-`, `@`, tab or carriage return get a leading apostrophe (CSV injection); numbers are untouched.

## PDF (ADR D-08)

`format=pdf` renders the same declared columns as a table with pdfmake 0.3: repeated header row, page numbers, landscape when there are more than five columns. Fonts are bundled (`@fontsource/inter` for Latin, `@fontsource/noto-sans-tamil` for Tamil); text is split into runs so Tamil letters use the Tamil font and the rest uses Inter. Other scripts are not supported yet and need their own spike.

- **Worker thread:** each PDF is laid out in its own `worker_threads` worker (`pdf/pdf-worker.js`, plain CommonJS copied to `dist` by `allowJs`), so the API event loop is never blocked. At most 2 PDFs render at once, up to 8 may wait, further requests get `429`. One PDF per user at a time (`429`). A render over 60 seconds is stopped (`503`).
- **No outside access:** the generator gets data only (title, columns, rows). URL access is denied and local-file access is limited to the four font files; a test proves an image URL or `/etc/hostname` is refused.
- **Cap:** at most **2,000 rows** per PDF (`422`, "use CSV or narrow the filters"); CSV stays at 10,000.
- Same permission, scope, column whitelist and audit as CSV. The audit entry has `format: pdf`; a render failure is audited as a failure with `reason: render_failed` and the client gets a generic `500`.

## Limits and audit

- At most **10,000 rows** per CSV export and **2,000** per PDF; more is `422` with "narrow the filters". Async exports for large data are not built yet (needs the job infrastructure).
- Each export writes an audit entry `report.export` (report name, format, row count, filter **names** only). The entry is written before the file is sent and fails closed: no audit entry, no file. A refused over-limit export is audited as a failure.

## Employee reports (#31)

Registered by the default app in `routes/index.ts`; a registry passed to `createApp` is used as given (tests). All three read the employee directory, need `employees.list` and are scoped by it: Admin and HR Manager see the company, a Team Lead sees direct reports only (D-26), Staff cannot run reports. The scope is applied inside each query.

| Report               | Filters                                                                                 | Columns                                                                            |
| -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `employee-headcount` | `groupBy` (`department` default, or `designation`), `departmentId`                      | Group, Active, Pending, Deactivated, Total                                         |
| `joiners-leavers`    | `from`, `to` (required, `YYYY-MM-DD`, at most 366 days, both ends included), `event` (`all`, `joined`, `left`), `departmentId` | Date, Event, Code, Employee, Department, Designation |
| `employee-directory` | `departmentId`, `designationId`, `managerId`, `status`                                  | Code, Employee, Email, Phone, Department, Designation, Manager, Status, Joining date |

A joiner's date is `joining_date`. A leaver's date is the day the employee was deactivated **in the company timezone** (`CompanySettingsReader`), so a deactivation at 00:30 IST on 1 November is a 1 November leaver. No report lists ID documents, bank or compensation fields; a test fails if a column name looks like one.

`employees.deactivated_at` (migration `20261030000013`) records the deactivation. A trigger sets it when `status` becomes `deactivated` and clears it on reactivation, and a CHECK keeps the two in agreement, so the deactivation endpoint (#26) only has to change the status. Existing deactivated rows were given their last update time. Leavers before this migration therefore have approximate dates.

## Not built yet

- **Async exports** for more than 10,000 rows (CSV) or 2,000 rows (PDF).
- Attendance, leave and task reports (#47).
