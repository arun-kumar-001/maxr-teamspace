# Development Roadmap

**Status:** Draft for TL review. The 7 phases are **[CONFIRMED T§5.2]**; the owner split, gates and sizing are **[RECOMMENDED]**. Sizes are relative effort (S ≈ 1–2 dev-days, M ≈ 3–5, L ≈ 6–10), not calendar commitments; the TL sets dates once D-02..D-13 are decided.

## 1. Team and branches
| Person | Branch | Owns |
|---|---|---|
| Technical Lead | `feature/global-setup` | Foundation, shared rules, tokens, shared UI, security, CI, reports framework, integration review |
| Developer 1 | `feature/employee-management` | Employee Management (M2), User & Role admin UI, Phase 6 expenses and company settings |
| Developer 2 | `feature/attendance-collaboration` | Attendance, Leave, Approvals, Notifications features, Projects/Tasks, Meetings |

Rule: no one edits another owner's module folders or shared files (see `implementation-dependencies.md` §5). With only two developers there is no need for a fourth branch; revisit if a third joins.

## 2. Phase plan

| Phase (report) | Goal | TL | Dev 1 | Dev 2 | Exit gate |
|---|---|---|---|---|---|
| **P0 Decisions** (pre-work) | Resolve blocking decisions | D-01..D-06, D-09, D-11, D-21, D-22 | — | read docs, local setup | ADR + ER update approved |
| **P1 Foundation** | Auth, base roles, DB, Docker, CI, shell | TL-01..TL-12 | prepare detailed plans; may prototype in own feature folder | same | Login works for 4 seeded roles; role dashboards render; CI green; DB migrates clean; IDOR test harness exists; merged to `main` |
| **P2 Employee Directory** | Profiles, departments, designations, search | review | D1-01..D1-06 | D2-01..D2-03, D2-05 (attendance + approvals engine; no dependency on D1 UI) | Directory + scoped views pass role tests |
| **P3 Employee Lifecycle** | Onboarding, documents with signed links, deactivation | storage adapter review | D1-07..D1-09 | D2-04 (correction requests) | Create→onboard→activate→deactivate E2E; sessions revoked |
| **P4 Daily Operations** | Attendance, leave, approvals, email | review | D1-10, D1-11 (user/role admin, audit viewer) | D2-06..D2-09 | Attendance+leave E2E; atomic approval proven by tests |
| **P5 Team Collaboration** | Projects/tasks, meetings, calendar sync | review | D1-13 company settings, then D1-12 prep | D2-10..D2-14 | Task lifecycle + meetings E2E |
| **P6 Expenses & Reports** | Expense claims + receipts, CSV/PDF reports, company settings | TL-13 reports framework | D1-12 expenses, D1-14 | D2-15 report queries | Reports scoped by role; exports audited |
| **P7 Testing & Launch** | Automated testing, security checks, backup drills, launch | TL-14, TL-15 + all fix findings | D1-15 | D2-16 | Security checklist, backup/restore drill, prod deploy runbook |

## 3. Prioritized implementation sequence
1. **Decisions** D-01..D-06, D-09, D-11, D-21 (unblocks everything).
2. **TL-01..TL-03** repo scaffold, dev environment, CI.
3. **TL-04..TL-07** DB base, auth, RBAC + scope, API conventions.
4. **TL-08..TL-10** tokens, shared UI, app shell with 4 role dashboards.
5. **TL-11..TL-12** audit logger, notification/storage adapters; docs for developers.
6. **Merge foundation to `main`; developers branch from it.**
7. Parallel: Dev 1 (departments → directory → create/update → profile → hierarchy → onboarding → documents → deactivation) and Dev 2 (attendance → approvals → leave → notifications → tasks → meetings).
8. Dev 1 user/role admin UI + audit viewer; settings; expenses (after approvals engine).
9. Reports framework (TL) and module report queries.
10. Hardening, security review, backup drill, launch.

## 4. Milestones
| Milestone | Definition |
|---|---|
| M-A Decision baseline | Decision register D-01..D-06, D-09, D-11, D-21, D-22 closed; consolidated ER approved |
| M-B Foundation merged | TL-01..TL-12 on `main`; developer setup doc verified by a clean checkout |
| M-C Employee core | D1-01..D1-06 merged; directory + profiles scoped |
| M-D Lifecycle | onboarding + documents + deactivation merged |
| M-E Daily ops | attendance + leave + approvals + email merged |
| M-F Collaboration | tasks/projects/meetings merged |
| M-G Reports & expenses | exports + expense claims merged |
| M-H Launch readiness | security checks done, backup drill passed, prod deployed |

## 5. Quality gates (every PR) [from `AGENTS.md` §10]
Typecheck · lint/format · unit tests · integration tests (real PostgreSQL, authorization per role, cross-scope denial) · component tests for non-trivial UI · Playwright for critical flows · migration up on clean DB · dependency audit · secret scan · docs updated · TL review.

## 6. Risks to schedule
D-05/D-10/D-11/D-13 late decisions; Cantobo access; two-developer bus factor; approvals engine becomes a bottleneck for expenses; reports depend on all data modules. Mitigation: decisions first, fakes for external services, TL reviews at each milestone.

## 7. What is explicitly deferred (optional / not mandatory)
Mobile app (D-07), SMS/OTP login, payroll export & payslips (D-16), calendar sync (D-18), Excel export (D-08), OAuth2/SSO. Not scheduled until the TL approves.
