# Decisions Log

Every business or technical decision the Technical Lead (TL) has made, newest first. If a rule is not here and not in the spec, ask on the issue; do not guess. IDs refer to `product-baseline.md` §10.

| Date | ID | Decision | Where |
|---|---|---|---|
| 2026-10-30 | D-05 | **Approved:** sessions live in Redis only (opaque token in an httpOnly cookie, CSRF token, Argon2id, per-account lockout, idle 2 h and absolute 24 h). The `sessions` table is dropped. | ADR D-05, `docs/architecture/auth.md` |
| 2026-10-29 | D-01 | Role codes are `admin`, `hr_manager`, `team_lead`, `staff`; display names live in one constant (`ROLE_DISPLAY_NAMES`). | #6 |
| 2026-10-29 | G-04 | Every user is linked to exactly one employee (`users.employee_id` NOT NULL UNIQUE). No system accounts without an employee for now. | #6, migration `foundation_schema` |
| 2026-10-29 | G-03/G-16 | Foundation tables only: departments, designations, employees, users, roles, permissions, role_permissions, user_roles, audit_logs, notification_outbox, login_attempts. Module tables are added by the migration of the module that owns them. | #6 |
| 2026-10-29 | D-22 | Visual style: MaxR Flow colours and fonts in the layout of the TL's dashboard references (floating dark teal sidebar, light content). No dark theme yet. | `docs/design/DESIGN.md` |
| 2026-10-29 | D-02 | npm workspaces (no pnpm), Express, React 18 + Vite + Tailwind 3, Node 22. | ADR D-02, `AGENTS.md` §2 |
| 2026-10-30 | (default) | **The TL's developers are working again; the TL assistant writes defaults for open business rules and records each here.** Defaults below can be changed by the TL at any time. | this file |

## Defaults chosen for open rules (change by editing here and telling the developers)
| ID | Question | Default | Used by |
|---|---|---|---|
| D-11 | What is a "team"? | A Team Lead's team is the employees whose `manager_id` is the Team Lead (direct reports, not recursive). "HR scope" is all employees. | #8, #19, #35 |
| D-21 | Who can edit permissions? | The four roles are fixed. The permission catalog is seeded in the database; roles get permissions from seeds/migrations only (no editing screen in the MVP). | #8, #27 |

New entries are added as each open rule is reached (D-12 leave states, D-13 shifts and timezone, D-17 expenses, ...).
