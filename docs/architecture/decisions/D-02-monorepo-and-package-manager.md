# ADR D-02: Modular Monolith, Monorepo Structure & Package Tooling

- **Status:** Proposed (awaiting Technical Lead approval)
- **Deciders:** Technical Lead (`arun-kumar-001`), pending
- **Date:** 2026-10-28
- **Context:** [Product Baseline §10 (D-02)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §2, §3](../../AGENTS.md)

---

## Context and Problem Statement

The specification overview refers to "modular microservices", while the High-Level Design (HLD) architecture section specifies "modular, layered" architecture with `/api/v1/*` routes.
Distributing services over network boundaries introduces distributed transaction complexity, network overhead, and high deployment overhead without justification for an internal staff management system.
Additionally, the repository requires clear boundaries between frontend, backend, and shared contract types.

## Decision Drivers

1. **Spec Alignment:** Strict module boundaries without premature microservice overhead.
2. **Type Safety & Reuse:** Zero-cost sharing of API request/response contracts, validation schemas, and domain types between frontend and backend.
3. **Developer Velocity:** Independent builds and execution with single-repository dependency management.
4. **Clean Code & Layering:** Modules communicate via exported service interfaces; cross-cutting utilities (auth, error mapping, pagination) live once in `packages/shared`.

## Decision

1. **Architecture Style:** We adopt a **Modular Monolith**.
   - Single deployable backend API service (`apps/api`).
   - Strict internal module boundaries: `auth`, `users`, `employees`, `attendance`, `leave`, `tasks`, `meetings`, `expenses`, `notifications`, `reports`, `admin`.
   - Internal layering inside every module: `routes/controller → service → repository → database`.
   - Direct database access across module boundaries is forbidden; modules communicate only via service interfaces.

2. **Monorepo Layout:**
   - `apps/web`: React + TypeScript frontend web application.
   - `apps/api`: Node.js + Express + TypeScript backend API service.
   - `packages/shared`: Shared TypeScript domain models, API error envelopes, HTTP contracts, and utility types.

3. **Workspace & Package Management:**
   - Standard workspace configuration using `pnpm` workspaces (`pnpm-workspace.yaml`) with dual compatibility via root `package.json` `workspaces: ["apps/*", "packages/*"]`.
   - Dependency hoisting and workspace protocols (`workspace:*`) for linking `packages/shared`.

## Consequences

### Positive

- Type changes in API contracts immediately reflect across both web and api packages during compilation.
- Eliminates network serialization and consensus overhead between modules.
- Streamlined CI pipeline with centralized linting, type-checking, and build orchestration.
- Seamless developer onboarding with unified dependency installation.

### Negative / Trade-offs

- Strict discipline required to prevent circular module dependencies (enforced by module linting and architecture rules).
- Build times must be managed with proper TypeScript project references (`tsconfig.build.json` / composite projects).

## Compliance

- Aligns with `AGENTS.md` §3 ("Modular monolith first").
- Aligns with `docs/architecture/implementation-dependencies.md` §5 file ownership rules.
