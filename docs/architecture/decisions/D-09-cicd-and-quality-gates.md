# ADR D-09: CI/CD Pipeline & Quality Gates

- **Status:** Proposed (awaiting Technical Lead approval)
- **Deciders:** Technical Lead (`arun-kumar-001`), pending
- **Date:** 2026-10-28
- **Context:** [Product Baseline §10 (D-09)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §10, §11](../../AGENTS.md)

---

## Context and Problem Statement

The specification approves GitHub Actions for continuous integration and automated deployment to Cantobo Server containers.
Quality regressions, broken types, security vulnerabilities, or database migration discrepancies must be intercepted before code merges into the integration branch (`develop`) or release branch (`main`).

## Decision Drivers

1. **Zero-Defect Integration:** Automated gates block PR merges if typecheck, linter, tests, or security scans fail.
2. **Deterministic Builds:** Package dependencies locked and verified.
3. **Role & Scope Testing:** Integration tests execute against real PostgreSQL containers to guarantee cross-scope authorization rules.
4. **Fast Developer Feedback:** Fast local checks mirroring CI pipelines.

## Decision

1. **Continuous Integration Platform:**
   - **GitHub Actions** is the designated CI/CD platform.
   - Triggers: Every Pull Request targeting `develop` and push events to `develop` and `main`.

2. **Mandatory Quality Gates (Every PR):**
   - **1. Typecheck:** Strict TypeScript check across all packages (`tsc --noEmit`). Zero tolerance for `any` or suppressions without approved issue link.
   - **2. Lint & Formatting:** ESLint and Prettier check (`npm run lint`, `npm run format:check`).
   - **3. Unit & Integration Tests:** Vitest test suites executing business rule state machines, scope resolvers, and repository queries against a clean PostgreSQL 16 container.
   - **4. Migration Integrity:** Verify database migrations apply cleanly (`UP`) and revert (`DOWN`) on an empty database.
   - **5. Build Validation:** Production build of `apps/api`, `apps/web`, and `packages/shared`.
   - **6. Security & Secret Scanning:** Dependency vulnerability audits (`audit`) and Git secret pattern detection.

3. **Branching Strategy:**
   - `main`: Protected production release branch. Direct pushes forbidden.
   - `develop`: Protected integration branch. All feature branches target `develop` via PR.
   - Feature branches: `feature/employee-management` (Dev 1), `feature/attendance-collaboration` (Dev 2), short-lived `global/*` or foundation branches.
   - Merge strategy: Merge commits into `develop` after Technical Lead review; no rebasing of shared branches.

## Consequences

### Positive

- Prevents breaking changes from entering `develop`.
- Standardized environment ensures local commands match remote CI runner results.
- Automated role-permission and IDOR security regression prevention.

### Negative / Trade-offs

- Integration tests with real PostgreSQL require container initialization in CI runners.
