# Repository Gap Analysis

**Status:** Draft · **Audit date:** 2026-10-28 · **Branch:** `feature/global-setup` (tracks `origin/feature/global-setup`) · **HEAD:** `b9e8c6a`
**Evidence method:** `git log`, `ls -a`, `find`, file inspection. Nothing is claimed that was not found in a file.

## 1. What exists in the repository

| Path | Content | Origin |
|---|---|---|
| `README.md` | 2-line description ("Internal company management platform for employee management, HRMS, attendance, leave, task tracking, projects, meetings, and reporting.") | Initial commit `195983f` |
| `AGENTS.md` | Project rules, tokens, conventions, open questions | Commit `52be3ec`, extended in `b9e8c6a` |
| `.claude/skills/*` | 5 agent skills (`design-taste-frontend`, `react-best-practices`, `composition-patterns`, `web-design-guidelines`, `21st-ui`) | `b9e8c6a` |
| `.mcp.json`, `skills-lock.json` | 21st MCP config (key via `API_KEY_21ST`), skill lock | `b9e8c6a` |
| `docs/**` | These planning documents (uncommitted at time of writing) | This phase |

**Not present:** application source, `package.json`/lockfile, frontend, backend, database schema/migrations, API, authentication/authorization, UI components, tests, CI/CD (`.github/`), Dockerfiles, Nginx config, `.env.example`, deployment config, developer setup docs.
Branches (verified with `git ls-remote`): `origin/main` = `195983f` (initial commit, README only); `origin/feature/global-setup` = `b9e8c6a`. `main` is not checked out locally. `feature/employee-management` and `feature/attendance-collaboration` do **not** exist yet.

**Conclusion: greenfield.** The repository supplies no implementation evidence for any requirement.

## 2. Requirement status (classification)

Classes: **IV** implemented & verified · **PI** partially implemented · **MS** missing · **IC** implemented but inconsistent with report · **BD** blocked by dependency · **PD** requires product decision.

| Area / requirement | Status | Evidence / blocker |
|---|---|---|
| Project rules (`AGENTS.md`) | **IV** (docs only) | `AGENTS.md` exists; contains TBD stack items |
| Design tokens (as written rules) | **PI** | Defined in `AGENTS.md` §8 only; no code; palette provisional (D-22) |
| Tech stack ADR | **PD** | D-02..D-05, D-09 |
| Monorepo/app scaffold | **MS** | no `package.json` |
| Docker/dev environment | **MS** | no Dockerfile/compose |
| CI/CD (GitHub Actions) | **MS** | no `.github/` |
| DB, migrations, seeds | **MS** | none |
| M1 Auth, sessions, rate limit | **MS** / **PD** (D-05) | none |
| M1 RBAC + scope, audit logs | **MS** | none |
| M2 Employee directory, profile, departments, designations | **MS** | none |
| M2 Onboarding / offboarding | **MS** / **PD** (D-19, D-20) | |
| M2 Documents + signed links | **MS** / **BD** (D-10) | needs storage adapter |
| M3 Attendance & shifts | **MS** / **PD** (D-13) | |
| M4 Leave, balances, holidays | **MS** / **PD** (D-12) | |
| M4a Approvals | **MS** | |
| M5 Projects & tasks | **MS** / **PD** (D-14) | |
| M6 Meetings | **MS** / **PD** (D-18) | |
| M6 Expenses | **MS** / **PD** (D-17) / **BD** on approvals | |
| M7 Notifications | **MS** / **PD** (D-15) | |
| M8 Reports (CSV/PDF), settings, backups | **MS** / **PD** (D-08) | |
| Payslips | **PD** (D-16) | payroll out of scope |
| Four role views / app shell | **MS** | |
| Shared UI components | **MS** | skills installed but no components |
| Testing (unit/integration/e2e) | **MS** | none |
| Security baseline (hashing, headers, rate limit, secrets) | **MS** | only rules in `AGENTS.md` |
| Developer onboarding docs | **MS** | planned `docs/development/` |

No requirement is **IC** because nothing is implemented.

## 3. Discrepancies between supplied inputs and the repository/session
| # | Finding |
|---|---|
| 1 | `AGENTS_UNIVERSAL.md` is referenced in the brief but was **not supplied** and does not exist in the repo or filesystem. Its rules are not incorporated. |
| 2 | "MAXR Flow color palette" is referenced but was **not supplied**. `AGENTS.md` §8 uses colors sampled from the report cover (navy `#0A1429/#0E2042`, teal `#14B8A6`) — provisional. No layout/components from MAXR Flow were reused. |
| 3 | Earlier in this session `AGENTS.md`, skills and MCP config were committed and pushed to `feature/global-setup` at the TL's request. No other source changes exist. |
| 4 | Product naming differs across README (maxr-teamspace), report (MAXR ONE), figures (MAXR CRM). |

## 4. Security and architecture risks (current state)
| ID | Risk | Likelihood / Impact | Mitigation |
|---|---|---|---|
| R-01 | Two developers start before shared foundation → duplicate/incompatible auth, schemas, UI | High / High | Gate feature work on TL-04..TL-10 |
| R-02 | Ambiguous scope definitions (team/HR) lead to data leakage (IDOR) | Med / High | D-11 early; scope engine + IDOR tests in CI |
| R-03 | JWT without revocation breaks "deactivation ends sessions" | Med / High | D-05: server sessions or revocable tokens |
| R-04 | Sensitive HR data (ID docs, bank, compensation) without retention/legal policy | Med / High | D-25; field-level permissions; encryption; log redaction |
| R-05 | Cantobo storage API unknown → delays P3 | Med / Med | Storage adapter + local fake; ask infra owner (D-10) |
| R-06 | ER lacks tables → ad-hoc migrations by devs collide | High / Med | Approve consolidated ER (G-03) before module work |
| R-07 | Atomicity bugs in leave approval/balance | Med / High | Transaction + row lock + failure-injection tests |
| R-08 | Race on check-in (two open sessions) | Med / Med | Partial unique index + 409 |
| R-09 | Unreviewed third-party skills/MCP run with agent permissions | Low / Med | Skills reviewed; pin via `skills-lock.json`; key via env only |
| R-10 | Secrets committed accidentally | Low / High | Secret scan in CI; `.env.example` only |
| R-11 | Scope creep into out-of-scope payroll/CRM | Med / Med | T§1.2 listed in `AGENTS.md`; PR checklist |
| R-12 | No timezone/shift policy → wrong attendance data | Med / Med | D-13 before P4 |

## 5. Required next verification
Before the Foundation implementation begins: confirm environment (Node version, package manager) with the TL; confirm Cantobo access details.
