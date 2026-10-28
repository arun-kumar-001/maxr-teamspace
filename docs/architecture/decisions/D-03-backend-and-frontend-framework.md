# ADR D-03: Backend & Frontend Framework Selection

- **Status:** Proposed (awaiting Technical Lead approval)
- **Deciders:** Technical Lead (`arun-kumar-001`), pending
- **Date:** 2026-10-28
- **Context:** [Product Baseline §10 (D-03)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §2, §4, §8](../../AGENTS.md)

---

## Context and Problem Statement

The report text specifies a React + TypeScript frontend and a Node.js modular backend under `/api/v1/*`. Figure 1 ambiguously mentions "React / Next.js" for the frontend and "Modular Services" for the backend.
An internal workforce management portal does not require Server-Side Rendering (SSR) or complex edge execution, but requires fast responsive interaction, clean architecture, high maintainability, and strict decoupling between presentation and business logic.

## Decision Drivers

1. **Backend Simplicity & Predictability:** Minimal, robust, production-tested HTTP framework in Node.js with strict layering.
2. **Strict Layering:** Clear separation: Controllers do HTTP only; Services own business rules and transactions; Repositories own SQL queries.
3. **Frontend Responsiveness:** SPA architecture with fluid design from phone (320px) to ultrawide (3440px) per `AGENTS.md` §8.
4. **Clean Code & Strict TypeScript:** `strict: true`, no `any`, explicit schemas.

## Decision

1. **Backend Framework: Node.js + Express + TypeScript (`apps/api`)**
   - **Framework:** Express.js 4/5 with TypeScript.
   - **Layering per module:**
     - `routes/` (Controller / HTTP boundary): URL routing, parameter parsing, schema validation, HTTP status codes.
     - `services/`: Core business logic, transaction boundaries, domain rules, state machine transitions.
     - `repositories/`: Parameterized SQL execution, scope filter injection (`WHERE team_id IN (...)`), data mapping.
   - **Cross-cutting Middleware:**
     - Authentication verification & session loading.
     - RBAC permission & scope guard (`module.action`).
     - Request ID generation & structured JSON logging.
     - Consistent error handler returning standard envelope: `{ error: { code, message, details, requestId } }`.
     - Rate limiting for sensitive endpoints (`/api/v1/auth/login`).

2. **Frontend Stack: React + TypeScript + Vite (`apps/web`)**
   - **Build Tool:** Vite for fast HMR and optimized builds.
   - **Routing:** React Router v6 (SPA client-side navigation).
   - **Styling & Design System:** Tailwind CSS configured with the authoritative brand tokens from `AGENTS.md` §8:
     - Navy dark surfaces: `--navy-950` (`#0A1429`), `--navy-900` (`#0E2042`), `--navy-800` (`#1E2F50`).
     - Primary accents: `--teal-500` (`#14B8A6`), `--teal-600` (`#0D9488`).
     - Semantic colors: Success (`#16A34A`), Warning (`#D97706`), Danger (`#DC2626`), Info (`#2563EB`).
     - Mandatory responsive tokens: `xs` (360px) to `4xl` (2560px), mobile-first layout.
   - **Feature Organization:** `src/features/<module>/{components,hooks,api,pages,types}`.

## Consequences

### Positive

- Direct adherence to the approved specification and clean code principles.
- Avoids unnecessary SSR complexity (Next.js server-side caching quirks, node runtime mismatch).
- Extremely fast development iteration and predictable debugging.
- Full type safety from database query results to React UI components.

### Negative / Trade-offs

- Express requires explicit middleware wiring for async errors (handled via standard async wrapper / express 5 native async error handler).
- Initial client bundle download for SPA (mitigated with Vite code-splitting and dynamic route imports).
