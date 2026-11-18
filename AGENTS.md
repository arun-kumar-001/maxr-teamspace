# AGENTS.md — MAXR Teamspace (MAXR ONE Staff Management)

Authoritative instructions for every AI coding agent and developer in this repo.
Keep this file short. Put detail in `docs/` and link to it.

> **Status legend used below:** **[SPEC]** = stated in the approved design PDF (v1.0).
> **[PROPOSED]** = Technical Lead recommendation, not yet decided (needs an ADR in `docs/architecture/decisions/`).
> **[TBD]** = unknown, do not assume.
> The foundation is in `develop` (scaffold, CI, local environment, API conventions, shared services, UI tokens and components); no business feature exists yet. Never claim a feature exists without verifying it in the code.

## 1. Product context

Internal web platform for workforce management: users/roles, employee directory, attendance & shifts, leave, projects & tasks, meetings & expenses, notifications, reports & admin. [SPEC]

**Out of scope** (do not build): Sales CRM, direct payroll processing (only attendance/leave summaries and read-only payslips), speculative employee fields not provided by the business owner. [SPEC]

### Roles (deny by default) [SPEC]

| Role             | Scope            | Notes                                                                  |
| ---------------- | ---------------- | ---------------------------------------------------------------------- |
| Admin            | Company-wide     | Users, roles, security, company config, audit logs                     |
| HR Manager       | HR scope         | Employees, onboarding/offboarding, leave/attendance policy, HR reports |
| Team Lead        | Own team only    | Team attendance, leave approval, task assignment, team reports         |
| Staff / Employee | Own records only | Own profile, check-in/out, leave, own tasks, payslips                  |

Identity documents, bank accounts and compensation need **explicit permission**.

### Module ownership / branches

| Branch                             | Owner                                                       | Scope                                                                         |
| ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `main`                             | Technical Lead (merges only)                                | Stable, reviewed releases                                                     |
| `develop`                          | Technical Lead (merges only)                                | Integration branch; **every developer PR targets this**                       |
| `global/<issue>` (short-lived)     | Dev 1 `maxrindia29` (backend) / Dev 2 `maxrindia30-vb` (UI) | Foundation issues #3–#17, cut from `develop`                                  |
| `feature/employee-management`      | Dev 1 `maxrindia29`                                         | Employee Management, user/role admin, settings, expenses (issues #18–#32)     |
| `feature/attendance-collaboration` | Dev 2 `maxrindia30-vb`                                      | Attendance, leave, approvals, notifications, tasks, meetings (issues #33–#48) |

The Technical Lead reviews and merges developer PRs into `develop`, then raises the single PR `develop → main` at each milestone. If a third developer joins, add a fourth work branch rather than overloading one.
Start with `docs/development/developer-onboarding.md`.

## 2. Verified technology stack

| Layer                                                              | Choice                                                                                                                                                               | Source                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Frontend                                                           | React + TypeScript, responsive (desktop + mobile web)                                                                                                                | [SPEC]                                                        |
| Backend                                                            | Node.js, modular layered services under `/api/v1/*`                                                                                                                  | [SPEC]                                                        |
| Database                                                           | PostgreSQL 16                                                                                                                                                        | [SPEC]                                                        |
| Cache                                                              | Redis (temporary caching only, never source of truth)                                                                                                                | [SPEC]                                                        |
| File storage                                                       | Cantobo Server encrypted private storage, signed links                                                                                                               | [SPEC]                                                        |
| Edge                                                               | Nginx (TLS, rate limiting)                                                                                                                                           | [SPEC]                                                        |
| Delivery                                                           | Docker containers, GitHub Actions to Cantobo Server                                                                                                                  | [SPEC]                                                        |
| Integrations                                                       | SMTP/SendGrid email, SMS, calendar sync, payroll export                                                                                                              | [SPEC]                                                        |
| Package manager, monorepo layout, backend framework, React version | **Decided (TL):** npm workspaces with one `package-lock.json` (no pnpm), `apps/web` + `apps/api` + `packages/shared`, Express, React 18 + Vite + Tailwind 3, Node 22 | Issue #52, ADR D-02                                           |
| ORM/query layer and migrations                                     | **Decided (TL):** PostgreSQL 16 with plain versioned SQL migrations and parameterised queries; no Prisma or Drizzle (ADR D-04)                                       | `docs/architecture/decisions/D-04-database-and-migrations.md` |
| Validation lib, test runners, lint/format, CI                      | **Decided (TL):** Zod 4, Vitest 5 with Testing Library, ESLint + Prettier, GitHub Actions quality gates (ADR D-03, D-09)                                             | `docs/architecture/decisions/`                                |
| UI kit, state/data-fetching lib                                    | **Proposed, awaiting TL approval** (shadcn/ui-style primitives on Tailwind; TanStack Query). Do not swap or add a second UI library without an ADR                   | `docs/architecture/decisions/`                                |

**[PROPOSED] defaults still open** (TL to confirm): TanStack Query for data fetching; shadcn/ui-style primitives on Tailwind; Playwright for E2E (issue #62); Conventional Commits.

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
- Comments explain _why_, not _what_. Match surrounding code style and density.

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

**Colours and fonts: MaxR Flow** (the company's product). **Layout, shape and component style:** the TL's dashboard references (Ondra, Petalo, Selvar). Full spec: `docs/design/DESIGN.md`; values: `apps/web/src/styles/tokens.css` (single source, mirrored in `tokens.ts`, kept in sync by a test). Use Tailwind token classes; never hardcode hex in components (a test enforces it).

| Token                                                 | Hex                                           | Use                                                                                             |
| ----------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `primary`                                             | `#46C7B8`                                     | MaxR Flow teal: active indicator, dots, bars, logo tile. **Never text, never white text on it** |
| `primary-strong`                                      | `#0D9488`                                     | Icons, focus ring                                                                               |
| `primary-deep` / `primary-ink`                        | `#0F766E`                                     | Solid primary buttons (white text) / teal text and links                                        |
| `primary-soft`                                        | `#E9F8F6`                                     | Soft teal fills, icon squares                                                                   |
| `bg` / `surface` / `surface-raised` / `surface-muted` | `#EEF2F1` / `#FBFCFC` / `#FFFFFF` / `#F2F5F4` | Page / cards / selected tiles, inputs, white buttons / strips and inner tiles                   |
| `border` / `border-strong`                            | `#E3E9E7` / `#D3DCD9`                         | Card outlines / inputs, outlined buttons                                                        |
| `text` / `text-muted` / `text-subtle`                 | `#13201E` / `#4F5C5A` / `#5F6C6A`             | Body and numbers / secondary / captions                                                         |
| `sidebar-*`                                           | `#0E2826` bg, `#1B3532` raised                | Floating dark teal sidebar                                                                      |
| `positive-*` / `negative-*`                           | soft + ink pairs                              | Change chips (`DeltaChip`)                                                                      |
| `tile-peach/yellow/blue/green`                        | pastels                                       | Attention tiles                                                                                 |
| `chart-1…7` + `chart-ink-1…7`                         | blue, teal, pink, purple, amber, green, red   | Data only                                                                                       |
| `success` `warning` `danger` `info`                   | `#16A34A` `#D97706` `#DC2626` `#2563EB`       | Status semantics (approved, pending, rejected, info)                                            |
| `brand-red`                                           | `#E5322D` **[approx., verify from logo]**     | Logo mark only                                                                                  |

Rules:

- Shell: **floating dark teal sidebar** = the shared `Sidebar` component (Petalo style: solid teal active pill; 24px radius, 16px from the window edges, collapses to an 88px icon rail, `SidebarDrawer` on phone), top bar on the page background, big greeting header. Light content area. No dark theme yet (decide before adding the theme toggle). `navy-*` tokens are legacy: never use them.
- Fonts: Outfit for greeting, titles and big numbers (`font-display`); Inter for UI text; system fallbacks.
- Radius: controls 12px, tiles 16px, cards/sidebar/modals 24px, chips fully round. Cards are almost flat (`shadow-card`); selected items `shadow-raised`; primary buttons `shadow-primary`.
- Status is never conveyed by color alone (icon/label too). Meet **WCAG 2.1 AA** (4.5:1 text contrast, visible focus, keyboard operable, labelled inputs, ARIA only when needed). Every new text/background pairing goes into `contrast.test.ts`.
- 8px spacing scale.

### Responsive and fluid layout (mandatory, every page) [SPEC T§3.1: responsive for desktop and mobile web]

One codebase must work from a small phone to a large/ultrawide monitor. Design **mobile-first, then scale up**; never build a desktop-only or mobile-only screen.

| Tier           | Width       | Layout expectations                                                                                                     |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Phone          | 320–639px   | Single column; sidebar becomes drawer or bottom nav; tables become cards/lists; full-width forms; 44×44px touch targets |
| Tablet         | 640–1023px  | 1–2 columns; collapsed icon rail; tables with priority columns                                                          |
| Laptop/desktop | 1024–1535px | Persistent sidebar; multi-column dashboards; full tables                                                                |
| Large monitor  | 1536–2559px | More columns/widgets (not stretched text); master-detail split panes; wider tables show more columns                    |
| Ultrawide/4K   | ≥2560px     | Content grids keep growing; readable text/forms capped (≈70ch / ≈960px) and centered; no tiny UI or empty void          |

Rules:

- Breakpoints live in tokens only (`xs 360 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · 3xl 1920 · 4xl 2560`); no per-component magic widths.
- Use fluid primitives: CSS grid/flex, `minmax()`, `auto-fit/auto-fill`, `clamp()` for type and spacing, container queries for components, `rem`/`%`/`fr` not fixed `px` widths, `dvh` for full-height layouts.
- No horizontal page scroll at any width (wide tables scroll inside their own container); no content clipped at 200% browser zoom or enlarged system text; honor safe-area insets and orientation change.
- App shell: drawer/bottom nav (phone) → icon rail (tablet) → full sidebar (desktop+), with sticky header; modals become full-screen sheets on phone.
- Data views: DataTable must define a card layout for phone and column priority for tablet; charts resize without overflow.
- Hover-only interactions are forbidden (touch + keyboard parity). Images/media responsive with intrinsic aspect ratios.
- **Responsive verification:** use the change-impact rules in §10. New pages and shared shell/layout changes cover all reference viewports before merge (360×640, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, 2560×1440 and 3440×1440). During iteration, check phone, tablet and desktop first. UI changes include phone and desktop screenshots in the PR when appearance changes.
- Every data view implements **loading, empty, error and forbidden** states, and every form shows inline validation plus a submit-in-progress state.
- Reuse components from `components/ui` (Button, Input, Select, DataTable, Modal, Badge, StatusPill, EmptyState, Toast, FormField, StatCard, MetricStrip, DeltaChip, SegmentedControl, IconButton, Sidebar, SidebarDrawer). Before creating a new component, search for an existing one. Do not add a second UI library.
- Workflow state badges use one shared mapping: leave (Applied/Pending/Approved/Rejected/Cancelled), task (To Do/In Progress/In Review/Completed/Blocked).

## 9. Business rules from the spec (implement exactly; ask when unclear)

- Leave: `Applied → Pending → Approved/Rejected → Cancelled`; balance per employee per year; approval is atomic with balance update. Holiday calendar affects day counts.
- Task: `To Do → In Progress → In Review → Completed`, plus `Blocked`.
- Onboarding: 4 steps `HR → System → IT/Admin → Employee`; account activates only after **all** checklist items verified.
- Attendance: one open session per employee; corrections go through approval (Team Lead / HR Manager).
- Deactivation ends all active login sessions.
- See `docs/requirements/` for full acceptance criteria (to be written).

## 10. Testing and quality gates

### Local development

Choose verification from the actual diff and its consumers. Batch related edits into a coherent change, then run the applicable checks once before reporting completion. This section governs local verification timing, including where older development docs request the full CI sequence before every push.

Before each verification command, check the task's existing results and identify the changed input or uncovered behavior that requires the command. Keep a compact task-local record of scope, command, code revision and result. A repeated command requires changed inputs, a failed check being investigated, or a documented environment difference. Use this record across follow-up requests to commit, push, create a PR and deploy.

| Change impact                                                        | Required local verification                                                                                                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only                                                   | Review accuracy, links and diff. Check formatting on changed documents.                                                                                                                                              |
| Static UI copy, placeholders, icons or styling                       | Changed-file lint/format and affected screen inspection. Run affected assertions when text, selectors or accessibility expectations change. Check phone and desktop for layout changes.                              |
| React state, hooks, forms, routing or API-client behavior            | Affected component/hook/client tests and web workspace typecheck. Exercise the changed interaction.                                                                                                                  |
| API validation or business logic                                     | Affected schema/service/HTTP tests and API workspace typecheck. Cover error paths and changed state transitions.                                                                                                     |
| SQL, repositories or migrations                                      | Affected tests against real PostgreSQL and API typecheck. For migrations, verify a clean install, upgrade from the previous schema with representative data, repeat application, and rollback where supported.       |
| Shared contracts, shared UI, tokens or configuration                 | Check affected consumers. Typecheck shared and consuming workspaces for contract changes, rebuilding shared output when needed. Run relevant contract, token, accessibility or build checks according to the change. |
| Auth, RBAC, scope, sensitive data, concurrency or critical workflows | Affected role/cross-scope denial and integration tests. Exercise retries, duplicate writes or concurrent operations when relevant. Run targeted E2E when browser-to-API behavior changes.                            |

- Run targeted test files with explicit paths, such as `npm run test --workspace=@maxr/web -- src/features/designations/__tests__/DesignationsPage.test.tsx`. Include callers and dependent features affected by the change.
- Run `tsc --noEmit` through the affected workspace's typecheck script once per completed code change. Static copy/style-only and documentation changes use the checks in the table. Cross-workspace changes include every affected workspace.
- Reuse successful results while the checked code, dependencies, configuration and relevant environment remain the same. After further edits, rerun checks whose inputs or behavior changed. Keep a brief record of commands, scope and results.
- Run independent checks concurrently when safe. Keep builds and dependent checks ordered. Reuse existing dependencies and database services. Run clean installs when lockfile/dependency state or reproducibility requires them.
- Use targeted E2E for changed critical flows (login, check-in/out, leave apply/approve, employee create). New pages, shared layout changes and responsive regressions receive phone/tablet/desktop checks. Complete the nine reference viewports before merge for new pages and shared shell/layout changes.
- Bug fixes start with a reproducer. Add a failing regression test for behavior bugs, then verify the fix. Visual-only defects may use a reproducible screenshot/browser check. Add tests for new business rules and meaningful uncovered behavior.
- Local full-suite runs require an explicit user request, unavailable CI at a required merge/release gate, or a concrete cross-feature dependency gap that targeted checks cannot cover. Identify that gap before starting the command. Use targeted local checks followed by CI for normal PR and release preparation.
- Before invoking a root script, inspect its constituent commands. Select affected workspace commands and reuse completed prerequisites. Schedule CPU-heavy test suites and builds with bounded concurrency to avoid resource-contention timeouts.
- Fix failures caused by the change. Report pre-existing failures and unavailable checks with their impact. Do not skip, disable or loosen tests to get green. Completion reports state what passed and what remains unverified.

### PR and release gates

Every PR must pass the required CI checks defined in `.github/workflows/ci.yml` and ADR D-09. CI provides full-workspace typecheck, lint/format, production builds, unit tests, PostgreSQL integration tests, migration/seed verification, dependency audit and secret scanning. PR evidence includes the relevant local checks and CI results. Run the required gates locally when CI is unavailable before merge or deployment.

Full Playwright E2E runs belong to final deployment, not routine pushes or PRs (TL decision, 2026-11-18). `.github/workflows/e2e.yml` can run manually and is a required predecessor of the Deploy job. Use targeted local browser checks when a changed critical interaction or layout needs them; do not start the full E2E suite for routine integration or main merges.

Before deployment, use the required CI results for the exact release revision as full-suite evidence. Check the commit and results before starting additional verification. Reuse successful checks for the same code and relevant environment. Run additional checks for documented deployment-specific gaps, including configuration and migration compatibility. Build required deployment artifacts, apply migrations and confirm deployment health with affected-flow smoke checks. Security, authorization, data integrity and responsive behavior remain acceptance requirements.

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

1. Read this file, the linked issue when provided, and relevant `docs/requirements` + `docs/architecture` pages. Reuse context already read during the task and reread when it changes.
2. Inspect existing code for reusable components/services; check `git status` and current branch.
3. Confirm the task is in your module's scope and not in §1 out-of-scope. List assumptions; ask if a business rule is ambiguous.

**After coding**

1. Run the checks selected by §10 for the completed change. Include commands, results and outstanding checks in the PR when requested.
2. Self-review the diff for: missing authz/scope check, unvalidated input, N+1 queries, missing states (loading/empty/error), hardcoded colors/secrets, leaked PII in logs.
3. Update documentation when behavior, contracts, setup or project status changes. Update `.env.example` when environment configuration changes. Keep edits scoped to the task.
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
11. Brand palette now follows the MaxR Flow product (screenshot supplied by the TL, sampled per pixel); official logo files and font names are still to be confirmed.

## 15. Reference docs (to be created)

`docs/requirements/` · `docs/architecture/` · `docs/security/` · `docs/development/` · `docs/project-status.md`
Spec source: `MAXR_ONE_Staff_Management_HLD_LLD_Architect_Specification.pdf` (v1.0 approved baseline).

## 16. Installed agent skills and tools

Project skills live in `.claude/skills/` (committed, so they load in cloud sessions). Review any new skill before adding it; skills run with full agent permissions.

| Skill                   | Source                                    | Use for                                                                                                                            |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `design-taste-frontend` | Leonxlnx/taste-skill (`skills-lock.json`) | Visual quality, dashboards/admin screens, anti-generic UI. **`docs/design/DESIGN.md` and the §8 tokens win over its suggestions.** |
| `react-best-practices`  | vercel-labs/agent-skills                  | React performance and patterns                                                                                                     |
| `composition-patterns`  | vercel-labs/agent-skills                  | Component composition, avoiding boolean-prop sprawl                                                                                |
| `web-design-guidelines` | vercel-labs/agent-skills                  | UI/accessibility review                                                                                                            |
| `21st-ui`               | 21st-dev/magic-mcp                        | Find/generate UI components via the 21st MCP                                                                                       |

- `.mcp.json` registers the 21st MCP. It needs the `API_KEY_21ST` environment variable (set it in the cloud environment secrets; never commit the key). Generated components must be adapted to `components/ui` and the §8 tokens.
- `VoltAgent/awesome-design-md` is a catalog of `DESIGN.md` examples, kept as reference only. Our own style is in `docs/design/DESIGN.md` (MaxR Flow colours in the reference dashboard layout).
