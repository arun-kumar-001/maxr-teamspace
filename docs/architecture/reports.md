# Reports framework

Issue #15. Modules supply report definitions; the framework supplies the routes, authorization, scope, validation, CSV export and audit.

## Routes

| Route                               | Permission       | Result                                                                 |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `GET /api/v1/reports`               | `reports.read`   | Reports the caller's role can run (name, title, columns)               |
| `GET /api/v1/reports/{name}`        | `reports.read`   | Paginated JSON preview (`page`, `pageSize`, plus the report's filters) |
| `GET /api/v1/reports/{name}/export` | `reports.export` | CSV download (`format=csv`, plus the same filters), audited            |

Admin and HR Manager reach reports with company scope, Team Lead with team scope (D-24), Staff not at all.

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

## Limits and audit

- At most **10,000 rows** per export; more is `422` with "narrow the filters". Async exports for large data are not built yet (needs the job infrastructure).
- Each export writes an audit entry `report.export` (report name, format, row count, filter **names** only). The entry is written before the file is sent and fails closed: no audit entry, no file. A refused over-limit export is audited as a failure.

## Not built yet

- **PDF** exporter: needs a PDF library, which requires an ADR (AGENTS.md §2). The export route takes `format`, so adding it is local to the service.
- **Async exports** for more than 10,000 rows.
- Real report definitions: they come with the employee (#19) and attendance (#35) data layers.
