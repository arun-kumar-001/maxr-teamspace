# Architecture Decision Records (ADRs)

This directory documents the foundational architecture and technology decisions for **MAXR Teamspace (MAXR ONE Staff Management)**.

Every major decision is tracked using an Architecture Decision Record (ADR) to ensure team alignment, maintain traceability to requirements, and prevent architectural divergence.

## Status Legend

- **Approved**: Formally decided by the Technical Lead. Only the Technical Lead may set this status.
- **Pending Approval**: Proposed decision requiring Technical Lead review and sign-off before downstream implementation.
- **Superseded**: Replaced by a newer decision.

## Decision Index

| ID                                                      | Title                                                    | Status   | Date       | Summary                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| [D-02](./D-02-monorepo-and-package-manager.md)          | Modular Monolith, Monorepo Structure & Package Tooling   | Approved | 2026-10-30 | Modular monolith with `apps/web`, `apps/api`, `packages/shared`; workspace package management.                     |
| [D-03](./D-03-backend-and-frontend-framework.md)        | Backend (Express + TypeScript) & Frontend (React + Vite) | Approved | 2026-10-30 | Express.js layered architecture (`routes -> service -> repository`) and React SPA with Tailwind CSS design tokens. |
| [D-04](./D-04-database-and-migrations.md)               | PostgreSQL 16 & Plain SQL Migrations (No Prisma)         | Approved | 2026-10-30 | PostgreSQL 16 with versioned plain SQL migrations; strict relational constraints; Prisma excluded.                 |
| [D-05](./D-05-authentication-and-sessions.md)           | Authentication & Revocable Session Strategy              | Approved | 2026-10-29 | Redis-only sessions in an httpOnly cookie, CSRF token, Argon2id, per-account lockout.                              |
| [D-08](./D-08-report-export-formats-and-pdf-library.md) | Report Export Formats & PDF Library                      | Proposed | 2026-10-30 | CSV done; PDF via pdfmake with bundled fonts, 2,000-row cap, worker thread.                                        |
| [D-09](./D-09-cicd-and-quality-gates.md)                | CI/CD Pipeline & Quality Gates                           | Approved | 2026-10-30 | GitHub Actions CI enforcing strict TypeScript, ESLint, Prettier, Vitest, and migration validation.                 |

---

_Related documents: [AGENTS.md](../../AGENTS.md), [Product Baseline](../requirements/product-baseline.md), [Implementation Dependencies](implementation-dependencies.md)._
