# Module Architecture Template (`apps/api/src/modules/_template`)

This directory defines the authoritative **layered structure** for all backend modules in MAXR Teamspace.
When implementing a new module (e.g. `employees`, `attendance`, `leave`), developers must copy this structure and adhere to the strict layer boundaries.

## Architecture Layers & Responsibilities

```
routes.ts (HTTP Routing & Parameter Parsing)
   │
   ▼
controller.ts (HTTP Envelope, Status Codes, Request/Response mapping)
   │
   ▼
service.ts (Business Logic, Validation, State Machine, Transactions)
   │
   ▼
repository.ts (SQL Execution, Parameterized Queries, Scope Filters)
   │
   ▼
PostgreSQL Database
```

### 1. `*.routes.ts`
- Mounts HTTP endpoints under `/api/v1/<plural-resource>`.
- Applies authentication (`authenticate`) and RBAC permission guards (`requirePermission('module.action')`).
- Applies request schema validation middleware.

### 2. `*.controller.ts`
- Extracts parameters from `req.params`, `req.query`, and `req.body`.
- Calls the corresponding service method.
- Returns standard HTTP response envelopes (`200 OK`, `201 Created`).
- Does **NOT** execute SQL, call third-party network services, or implement domain validation.

### 3. `*.service.ts`
- Owns business rules, entity state transitions, and validation.
- Coordinates database transactions when multiple tables must update atomically (e.g. leave request + balance).
- Emits events / notifications via the notification outbox interface.
- Throws `AppError` with standard error codes (`BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`, etc.).
- Does **NOT** import Express `Request` or `Response` objects.

### 4. `*.repository.ts`
- The **only** layer that executes SQL queries.
- Must use parameterized queries (`$1, $2, ...`) to prevent SQL injection.
- Applies scope filters (`WHERE team_id IN (...)` or `WHERE employee_id = $1`) directly in the SQL query, never post-fetch.
- Returns domain entities or `null` (never leaks out-of-scope rows).

### 5. `*.types.ts`
- Declares domain entities, DTOs (Create/Update inputs), and query filter parameters.
- Reuses shared types from `@maxr/shared` wherever possible.

---

## Non-Negotiable Rules
1. **No SQL in Controllers or Services.**
2. **No HTTP types (`Request`, `Response`) in Services or Repositories.**
3. **No Direct Table Access Across Modules:** Modules talk exclusively through exported service interfaces.
4. **Deny by Default:** Every endpoint must require an authenticated session and verified permission.

