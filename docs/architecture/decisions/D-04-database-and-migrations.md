# ADR D-04: Database Engine & Plain SQL Migrations Strategy

- **Status:** Approved
- **Deciders:** Technical Lead (`arun-kumar-001`)
- **Date:** 2026-10-28
- **Context:** [Product Baseline §10 (D-04)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §6](../../AGENTS.md)

---

## Context and Problem Statement

The report specification approves PostgreSQL 16 as the primary data store and Redis for temporary caching.
For schema management and query execution:

- Spec and project rules demand strict database constraints (NOT NULL, FK, UNIQUE, CHECK, partial unique indexes for attendance sessions, atomic row-locking for leave balances).
- ORMs like Prisma introduce abstraction layers, schema DSL lock-in, connection engine overhead, and friction with fine-grained PostgreSQL features (such as partial unique indexes `WHERE check_out IS NULL` and transactional row locks `FOR UPDATE`).
- Issue TL-01 explicitly mandates: _"PostgreSQL; Plain SQL migrations; do not introduce Prisma"_.

## Decision Drivers

1. **Explicit Control & Relational Rigor:** Plain SQL migrations allow full access to native PostgreSQL 16 features (partial indexes, window functions, trigger functions, generated columns, and row-level locks).
2. **Schema Versioning Integrity:** Versioned, timestamped, reversible migration files that run cleanly in CI and production.
3. **Auditability & Review:** Every SQL migration is reviewed as plain DDL in Git PRs.
4. **Performance:** Parameterized SQL queries executed directly with connection pooling via `pg` (node-postgres), avoiding ORM mapping penalties.

## Decision

1. **Database Engine:**
   - **PostgreSQL 16** is the sole authoritative primary relational database.
   - Redis is used strictly for temporary session caching and rate-limiting counters (never source of truth).

2. **Migration Tooling & Structure:**
   - Plain SQL migrations runner executing ordered `.sql` files (`YYYYMMDDHHMMSS_name.sql`).
   - Each migration contains an `UP` script and, where supported, a `DOWN` script.
   - Applied migrations are recorded in a dedicated tracking table (`schema_migrations`).
   - Direct hand-editing of applied migrations is strictly forbidden.
   - Schema changes must be backward-compatible and tested on clean empty databases in CI.

3. **Database Conventions:**
   - **Identifiers:** `snake_case`, plural table names (e.g. `leave_requests`, `employees`, `attendance`).
   - **Primary Keys:** UUID PKs generated via `gen_random_uuid()`.
   - **Foreign Keys:** `<entity>_id` with explicit `REFERENCES` and appropriate `ON DELETE` behavior.
   - **Auditing:** `created_at` and `updated_at` stored as `timestamptz` in UTC.
   - **Required Constraints:**
     - Partial unique index: at most one open attendance session per employee (`UNIQUE (employee_id) WHERE check_out IS NULL`).
     - Soft deactivation: `is_active` boolean or status enum rather than physical DELETE.
     - Atomic transactions with row-level locking (`SELECT ... FOR UPDATE`) for balance updates.

## Consequences

### Positive

- Zero ORM impedance mismatch; 100% fidelity with PostgreSQL 16 capabilities.
- Clear SQL migration scripts that can be validated against PostgreSQL in Docker during CI.
- No heavy binary engines or Prisma query engine dependencies.
- Precise control over query optimization, indexes, and execution plans.

### Negative / Trade-offs

- Developers write raw SQL and repository mapping functions manually.
- Repositories must maintain strict type safety between SQL query results and TypeScript domain models.
