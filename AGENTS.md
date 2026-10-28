# AGENTS.md — MAXR Teamspace (MAXR ONE Staff Management)

Authoritative instructions for every AI coding agent and developer in this repo.
Keep this file short. Put detail in `docs/` and link to it.

> **Status legend used below:** **[SPEC]** = stated in the approved design PDF (v1.0).
> **[PROPOSED]** = Technical Lead recommendation, not yet decided (needs an ADR in `docs/architecture/decisions/`).
> **[TBD]** = unknown, do not assume.
> The repo currently contains only `README.md`. No application code exists yet. Never claim a feature exists without verifying it in the code.

## 1. Product context

Internal web platform for workforce management: users/roles, employee directory, attendance & shifts, leave, projects & tasks, meetings & expenses, notifications, reports & admin. [SPEC]

**Out of scope** (do not build): Sales CRM, direct payroll processing (only attendance/leave summaries and read-only payslips), speculative employee fields not provided by the business owner. [SPEC]

### Roles (deny by default) [SPEC]
| Role | Scope | Notes |
|---|---|---|
| Admin | Company-wide | Users, roles, security, company config, audit logs |
| HR Manager | HR scope | Employees, onboarding/offboarding, leave/attendance policy, HR reports |
| Team Lead | Own team only | Team attendance, leave approval, task assignment, team reports |
| Staff / Employee | Own records only | Own profile, check-in/out, leave, own tasks, payslips |

Identity documents, bank accounts and compensation need **explicit permission**.

### Module ownership / branches
| Branch | Owner | Scope |
|---|---|---|
| `main` | Technical Lead (merges only) | Stable, reviewed releases |
| `develop` | Technical Lead (merges only) | Integration branch; **every developer PR targets this** |
| `global/<issue>` (short-lived) | Dev 1 `maxrindia29` (backend) / Dev 2 `maxrindia30-vb` (UI) | Foundation issues #3–#17, cut from `develop` |
| `feature/employee-management` | Dev 1 `maxrindia29` | Employee Management, user/role admin, settings, expenses (issues #18–#32) |
| `feature/attendance-collaboration` | Dev 2 `maxrindia30-vb` | Attendance, leave, approvals, notifications, tasks, meetings (issues #33–#48) |

The Technical Lead reviews and merges developer PRs into `develop`, then raises the single PR `develop → main` at each milestone. If a third developer joins, add a fourth work branch rather than overloading one.
Start with `docs/development/developer-onboarding.md`.

## 2. Verified technology stack

| Layer | Choice | Source |
|---|---|---|
| Frontend | React + TypeScript, responsive (desktop + mobile web) | [SPEC] |
| Backend | Node.js, modular layered services under `/api/v1/*` | [SPEC] |
| Database | PostgreSQL 16 | [SPEC] |
| Cache | Redis (temporary caching only, never source of truth) | [SPEC] |
| File storage | Cantobo Server encrypted private storage, signed links | [SPEC] |
| Edge | Nginx (TLS, rate limiting) | [SPEC] |
| Delivery | Docker containers, GitHub Actions to Cantobo Server | [SPEC] |
| Integrations | SMTP/SendGrid email, SMS, calendar sync, payroll export | [SPEC] |
| Node framework, ORM/query layer, migrations tool, validation lib, UI kit, state/data-fetching lib, test runners, package manager, monorepo layout | **[TBD]** — decide via ADR before the first feature | — |

**[PROPOSED] defaults for the ADR** (TL to confirm): pnpm workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`); Vite + React Router + TanStack Query; Tailwind + shadcn/ui-style primitives; Fastify or NestJS; Zod for validation shared with the web app; Prisma or Drizzle with SQL migrations; Vitest + Testing Library + Playwright; ESLint + Prettier; Conventional Commits.

Until the ADR lands, do **not** add a framework or library "to get started". Do not commit a lockfile for a package manager that has not been chosen.

## 3. Architecture rules

- **Modular monolith first.** One deployable API with strict module boundaries. The PDF calls them "modular microservices" in the overview but "modular, layered" in the HLD; treat as modules and do not split into network services without an ADR.
- Backend modules (one folder each): `auth`, `users`, `employees`, `attendance`, `leave`, `tasks`, `meetings`, `expenses`, `notifications`, `reports`, `admin`, plus `shared`.
- Layering inside a module: `routes/controller → service → repository → DB`. Controllers do HTTP only; services own business rules and transactions; repositories own SQL. No SQL in controllers, no HTTP types in services.
- Modules talk only through another module's exported **service interface**, never its tables or repositories. No circular dependencies.
- Dependency direction: `web → api contract`, `api modules → shared`. `shared` depends on nothing in the app.
- Cross-cutting (auth, RBAC, validation, error mapping, logging, pagination) lives in `shared` and is the **only** implementation. Do not re-implement it per module.
- Side effects (email, SMS, calendar) go through an interface with an adapter, so tests use fakes.
- Design patterns only when they remove real duplication or coupling (repository, adapter, state machine for workflows, strategy for policies). No pattern for its own sake.

## 4. Clean code principles

SOLID, DRY, KISS, YAGNI, separation of concerns.
- Small functions, one reason to change; prefer composition over inheritance.
- Strict TypeScript (`strict: true`, no `any`, no `@ts-ignore` without a linked reason).
- Make illegal states unrepresentable: model workflows with explicit state enums + transition tables, not free-form strings.
- No dead code, no commented-out code, no speculative abstractions, no TODO without an issue link.
- Comments explain *why*, not *what*. Match surrounding code style and density.

### Naming & structure
- Files/folders: `kebab-case`. React components `PascalCase.tsx`. Variables/functions `camelCase`. Types/classes `PascalCase`. Constants `UPPER_SNAKE_CASE`.
- DB: `snake_case`, plural tables (`leave_requests`), `id` UUID PK, FK `<entity>_id`, `created_at`/`updated_at` `timestamptz`.
- API: `kebab-case` plural nouns (`/leave-requests`), JSON `camelCase`.
- Feature folders in web: `features/<module>/{components,hooks,api,pages,types}`; shared UI in `components/ui`.

## 5. API conventions

- Base path `/api/v1`. Resource-oriented REST; actions that are state transitions are sub-resources (`POST /employees/{id}/deactivate`, `POST /approvals/{id}/approve`). [SPEC]
- Every endpoint: authenticate → authorize (role **and** record scope) → validate input → execute. Reject by default.
- Validate all input at the boundary with a schema (body, query, params); never trust client-supplied `userId`, role or team.
- Consistent error envelope: `{ "error": { "code": "STRING_CODE", "message": "...", "details": [...], "requestId": "..." } }`. Correct HTTP codes (400/401/403/404/409/422/429). Never leak stack traces or whether a forbidden record exists (prefer 404 over 403 for out-of-scope records).
- List endpoints are paginated (`page`, `pageSize` with a max, stable sort) and return `{ data, meta: { page, pageSize, total } }`.
- Write endpoints that can be retried (check-in, approvals) must be idempotent or reject duplicates with 409.
- Document every endpoint in `docs/architecture/api.md` (or OpenAPI) in the same PR.

## 6. Database conventions

- Schema changes only via versioned, reviewed migrations. Never edit an applied migration; never hand-edit a shared DB.
- Constraints in the DB, not just in code: NOT NULL, FK, UNIQUE, CHECK. Examples from spec: unique employee code; **at most one open attendance session per employee** (partial unique index); leave approval updates balance **and** request state in **one transaction**. [SPEC]
- Index every FK and every column used in filters/sorts; justify new indexes in the migration.
- Soft-deactivate people (`is_active`/status) rather than deleting; keep audit history.
- Use transactions for multi-row writes; pick the isolation/locking needed for balance updates (row lock on the balance).
- Store timestamps in UTC; display in the user's timezone. [TBD: company timezone and work-week rules]

## 7. Security and authorization (non-negotiable)

- **Deny by default.** Server enforces role + record scope on **every** query. Hiding UI is cosmetic only. [SPEC]
- Scope filters are applied in the repository query (e.g. `WHERE team_id IN (caller's teams)`), not after fetching. Team Leads never see other teams' profiles or approvals.
- Passwords hashed with Argon2id (or bcrypt cost ≥ 12). Short-lived access tokens, httpOnly+Secure+SameSite cookies preferred over localStorage; deactivation must revoke active sessions. [PROPOSED]
- `POST /auth/login` rate-limited with lockout/backoff; generic failure messages.
- Parameterized queries only. Escape/encode output. No `dangerouslySetInnerHTML` with user data. CSRF protection if cookie auth is used.
- Sensitive fields (ID documents, bank, compensation) need explicit permission, are excluded from default responses and logs, and encrypted at rest where stored.
- Files: private bucket, type/size allow-list, virus-scan hook, access only via short-lived signed links after an authorization check.
- Secrets only from environment/secret store. **Never commit** `.env`, keys, tokens, dumps. Provide `.env.example` with placeholders only.
- Audit log for auth events, role changes, approvals, deactivation, exports. Never log passwords, tokens or PII payloads.
- Run dependency audit and secret scan in CI. Details: `docs/security/` (to be written).

## 8. Design system and UI

Derived from the brand cover of the design PDF (sampled colors). **Confirm with the business owner / brand assets before treating as final.** Define them once as CSS variables / Tailwind theme tokens; never hardcode hex in components.

| Token | Hex | Use |
|---|---|---|
| `--navy-950` | `#0A1429` | App shell / dark surfaces, sidebar |
| `--navy-900` | `#0E2042` | Dark panels, headers |
| `--navy-800` | `#1E2F50` | Cards on dark, borders |
| `--teal-500` (primary accent) | `#14B8A6` | Primary buttons, links, active nav, focus ring |
| `--teal-600` | `#0D9488` | Primary hover/pressed |
| `--brand-red` | `#E5322D` **[approx., verify from logo]** | Logo mark only, not UI semantics |
| `--bg` | `#F6F8FB` | Light page background |
| `--surface` | `#FFFFFF` | Cards, tables, forms |
| `--text` / `--text-muted` | `#0F172A` / `#475569` | Body / secondary text |
| `--border` | `#E2E8F0` | Dividers, inputs |
| `--success` `--warning` `--danger` `--info` | `#16A34A` `#D97706` `#DC2626` `#2563EB` | Status semantics (approved, pending, rejected, info) |

Rules:
- Light theme is default; dark navy for shell. Support both via tokens. Font: Inter (matches the PDF), system fallback.
- Status is never conveyed by color alone (icon/label too). Meet **WCAG 2.1 AA** (4.5:1 text contrast, visible focus, keyboard operable, labelled inputs, ARIA only when needed).
- 8px spacing scale; radius 8px cards, 6px inputs.

### Responsive and fluid layout (mandatory, every page) [SPEC T§3.1: responsive for desktop and mobile web]
One codebase must work from a small phone to a large/ultrawide monitor. Design **mobile-first, then scale up**; never build a desktop-only or mobile-only screen.

| Tier | Width | Layout expectations |
|---|---|---|
| Phone | 320–639px | Single column; sidebar becomes drawer or bottom nav; tables become cards/lists; full-width forms; 44×44px touch targets |
| Tablet | 640–1023px | 1–2 columns; collapsed icon rail; tables with priority columns |
| Laptop/desktop | 1024–1535px | Persistent sidebar; multi-column dashboards; full tables |
| Large monitor | 1536–2559px | More columns/widgets (not stretched text); master-detail split panes; wider tables show more columns |
| Ultrawide/4K | ≥2560px | Content grids keep growing; readable text/forms capped (≈70ch / ≈960px) and centered; no tiny UI or empty void |

Rules:
- Breakpoints live in tokens only (`xs 360 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · 3xl 1920 · 4xl 2560`); no per-component magic widths.
- Use fluid primitives: CSS grid/flex, `minmax()`, `auto-fit/auto-fill`, `clamp()` for type and spacing, container queries for components, `rem`/`%`/`fr` not fixed `px` widths, `dvh` for full-height layouts.
- No horizontal page scroll at any width (wide tables scroll inside their own container); no content clipped at 200% browser zoom or enlarged system text; honor safe-area insets and orientation change.
- App shell: drawer/bottom nav (phone) → icon rail (tablet) → full sidebar (desktop+), with sticky header; modals become full-screen sheets on phone.
- Data views: DataTable must define a card layout for phone and column priority for tablet; charts resize without overflow.
- Hover-only interactions are forbidden (touch + keyboard parity). Images/media responsive with intrinsic aspect ratios.
- **Verification (part of Definition of Done):** every new page is checked at 360×640, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, 2560×1440 and 3440×1440; critical flows run in Playwright at a phone, tablet and desktop viewport; UI PRs include screenshots at phone and desktop widths.
- Every data view implements **loading, empty, error and forbidden** states, and every form shows inline validation plus a submit-in-progress state.
- Reuse components from `components/ui` (Button, Input, Select, DataTable, Modal, Badge, StatusPill, EmptyState, Toast, FormField). Before creating a new component, search for an existing one. Do not add a second UI library.
- Workflow state badges use one shared mapping: leave (Applied/Pending/Approved/Rejected/Cancelled), task (To Do/In Progress/In Review/Completed/Blocked).

## 9. Business rules from the spec (implement exactly; ask when unclear)

- Leave: `Applied → Pending → Approved/Rejected → Cancelled`; balance per employee per year; approval is atomic with balance update. Holiday calendar affects day counts.
- Task: `To Do → In Progress → In Review → Completed`, plus `Blocked`.
- Onboarding: 4 steps `HR → System → IT/Admin → Employee`; account activates only after **all** checklist items verified.
- Attendance: one open session per employee; corrections go through approval (Team Lead / HR Manager).
- Deactivation ends all active login sessions.
- See `docs/requirements/` for full acceptance criteria (to be written).

## 10. Testing and quality gates

Every PR must pass, and agents must run locally before declaring done:
1. Typecheck, lint, format check.
2. Unit tests for services/business rules (state transitions, balance math, scope filters).
3. Integration tests for API endpoints against a real PostgreSQL (migrations applied), including **authorization tests per role** and **cross-scope denial** (Team Lead A cannot read Team B).
4. Component tests for non-trivial UI; Playwright E2E for critical flows (login, check-in/out, leave apply/approve, employee create).
5. Migration up (and down where supported) on a clean DB.
6. No new high/critical dependency vulnerabilities; no secrets in diff.

Bug fix = failing test first. Do not skip, disable or loosen tests to get green.

## 11. Git, commits and PRs

- `main` = stable branch, `develop` = integration branch. **Never commit or push directly to `main` or `develop`.** Never force-push shared branches, rewrite others' history, or delete branches.
- Flow: your branch → PR into `develop` → Technical Lead reviews and merges → Technical Lead raises `develop → main`. Developers never open PRs into `main`.
- Work on your assigned branch (see §1), one PR per issue, linked with `Closes #<n>`. Merge `develop` into your branch before opening a PR (merge commits; do not rebase shared branches).
- Agents: **do not commit, push, merge or deploy unless the user explicitly asks.** Do not open a PR unless asked.
- Commits: Conventional Commits (`feat(leave): ...`, `fix(auth): ...`), small and focused, one concern each.
- PR must include: linked issue, summary, screenshots for UI, test evidence, migration/rollback notes, security impact, docs updated.
- Include the Claude attribution trailer on agent-authored commits as configured by the harness.

## 12. Shared files: restricted

Changes need Technical Lead approval. Foundation issues #3–#17 may touch them only for the developer assigned to that issue. Feature work (issues #18–#48) must not edit them: open an issue or comment and wait. Files:
`AGENTS.md`, `docs/architecture/**`, `docs/security/**`, root configs (tsconfig, eslint, prettier, docker, nginx), `.github/**` (CI/CD), `packages/shared/**`, auth/RBAC middleware, design tokens, `components/ui/**`, DB migrations that touch shared tables (`users`, `roles`, `employees`, `departments`).

If a feature needs a change there, stop and flag it instead of editing it.

## 13. Required workflow for every task

**Before coding**
1. Read this file, the linked issue, and the relevant `docs/requirements` + `docs/architecture` pages.
2. Inspect existing code for reusable components/services; check `git status` and current branch.
3. Confirm the task is in your module's scope and not in §1 out-of-scope. List assumptions; ask if a business rule is ambiguous.

**After coding**
1. Run the quality gates in §10 and paste results in the PR.
2. Self-review the diff for: missing authz/scope check, unvalidated input, N+1 queries, missing states (loading/empty/error), hardcoded colors/secrets, leaked PII in logs.
3. Update docs (`docs/project-status.md`, API docs) and `.env.example` if config changed.
4. Report honestly: what is done, verified, skipped or failing.

## 14. Open questions / spec discrepancies (do not silently resolve)

1. Overview says "modular **microservices**"; HLD says "modular, layered". Assumed modular monolith.
2. Figure 1 is titled "MAXR **CRM**" while Sales CRM is out of scope; confirm naming.
3. "Cantobo Server" hosting/storage API is unspecified (S3-compatible? SDK?). Needed before Phase 3 uploads.
4. Leave flow `Applied ➔ Pending` is ambiguous (what is the difference?); `Cancelled` allowed from which states?
5. Auth mechanism (JWT vs server sessions), SSO, MFA and password policy not specified. Spec says "secure session token" and "end active login sessions".
6. Payslips: "read-only payslips" but payroll is out of scope; where does the data come from?
7. Shift rules, work-week, timezone, holiday calendar ownership, leave types and accrual rules not specified.
8. Team model (a person in one team or many?) and "HR scope" boundaries not defined.
9. SMS and calendar-sync providers not named.
10. `AGENTS_UNIVERSAL.md` was referenced but not supplied in this session; its rules are not yet merged here.
11. Brand palette is sampled from the PDF cover; no official brand guide was provided.

## 15. Reference docs (to be created)

`docs/requirements/` · `docs/architecture/` · `docs/security/` · `docs/development/` · `docs/project-status.md`
Spec source: `MAXR_ONE_Staff_Management_HLD_LLD_Architect_Specification.pdf` (v1.0 approved baseline).

## 16. Installed agent skills and tools

Project skills live in `.claude/skills/` (committed, so they load in cloud sessions). Review any new skill before adding it; skills run with full agent permissions.

| Skill | Source | Use for |
|---|---|---|
| `design-taste-frontend` | Leonxlnx/taste-skill (`skills-lock.json`) | Visual quality, dashboards/admin screens, anti-generic UI. **Brand tokens in §8 win over its palette suggestions.** |
| `react-best-practices` | vercel-labs/agent-skills | React performance and patterns |
| `composition-patterns` | vercel-labs/agent-skills | Component composition, avoiding boolean-prop sprawl |
| `web-design-guidelines` | vercel-labs/agent-skills | UI/accessibility review |
| `21st-ui` | 21st-dev/magic-mcp | Find/generate UI components via the 21st MCP |

- `.mcp.json` registers the 21st MCP. It needs the `API_KEY_21ST` environment variable (set it in the cloud environment secrets; never commit the key). Generated components must be adapted to `components/ui` and the §8 tokens.
- `VoltAgent/awesome-design-md` is a catalog of `DESIGN.md` examples, kept as reference only. When the TL picks a style, write our own `docs/design/DESIGN.md` from §8 instead of copying a brand's file.
