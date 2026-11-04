# ADR D-10: Production Hosting, Deployment & Infrastructure

- **Status:** Approved
- **Deciders:** Technical Lead (`arun-kumar-001`), approved 2026-11-04
- **Date:** 2026-11-04
- **Context:** [Product Baseline §10 (D-10)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §2, §7, §8](../../AGENTS.md), [ADR D-09 (CI/CD Quality Gates)](./D-09-cicd-and-quality-gates.md), [ADR D-25 (Data Protection & Retention)](./D-25-data-retention-and-protection.md)

---

## Context and Problem Statement

MAXR Teamspace is an internal workforce management system requiring high availability, strict role-based access control, confidential data handling (payroll slips, personal employee records, attendance), and predictable operational maintenance.
The system specification approves containerized delivery to private Cantobo Server infrastructure, fronted by Nginx with TLS termination, rate limiting, and encrypted offsite backups.
We must formalize the infrastructure hosting model, environment segregation (staging vs. production), continuous deployment pipelines, automated backup drill mechanics, and observability standards.

---

## Decision Drivers

1. **Confidentiality & Compliance:** All customer and employee data must remain strictly isolated on dedicated encrypted volumes; database and cache services must never be exposed directly to the public internet.
2. **Deterministic & Audited Releases:** Deployments must be fully automated via GitHub Actions pipelines with verifiable health probes and fast rollback capabilities.
3. **Data Durability & Disasters Recovery:** Automated daily encrypted database and upload volume backups with verifiable restore drills (RPO 24h, RTO < 1h).
4. **Least Privilege Container Architecture:** Containers run as unprivileged users (`node:node`, unprivileged Nginx on ports 8080/8443) with read-only root filesystems and dropped Linux capabilities.
5. **Observability & Health Probing:** Standardized liveness and readiness endpoints with zero disclosure of sensitive internal connection strings or stack traces.

---

## Decision

### 1. Hosting Environment & Topology (Cantobo Server)

- **Host Infrastructure:** Cantobo Dedicated Cloud Linux host running Ubuntu 24.04 LTS with Docker Engine and Compose v2.
- **Port Exposure:** Only public ports **80** (HTTP redirect to HTTPS) and **443** (HTTPS / TLS) are exposed on the host.
- **Internal Network Segregation:**
  - `web` (Nginx unprivileged): Listens on 8080 and 8443 inside container, maps to host 80/443. Serves the pre-built React SPA and proxies `/api/v1/*` to the `api` container.
  - `api` (Node 22 Express): Listens on internal port 4000 on an isolated Docker bridge network (`internal`). Runs with read-only root filesystem, dropped capabilities (`cap_drop: [ALL]`), and `no-new-privileges: true`.
  - `postgres` (PostgreSQL 16): Bound to internal network only; data stored on dedicated Docker volume `postgres_data`.
  - `redis` (Redis 7): Bound to internal network only, protected by high-entropy password; used exclusively for volatile sessions and transient caching (never source of truth).
  - `migrate` (Database Migration Runner): One-shot container using the compiled API image and `apps/api/dist/db/migrator.js` executed under the `ops` compose profile before web/API traffic cutover.

### 2. Environment Segregation

- **Staging Environment (`staging.maxr.internal`):**
  - Continuous deployment from `develop` upon successful merge and CI pipeline green.
  - Dedicated staging database, isolated Redis instance, separate encryption salts, and test notification sinks.
  - Used for developer integration, multi-role smoke testing, and responsive UI validation across target viewports.
- **Production Environment (`teamspace.maxr.internal`):**
  - Gated deployment triggered by tagged releases (`v*.*.*`) or manual dispatch approval from the Technical Lead.
  - Production secrets sourced exclusively from Cantobo secret store / GitHub Actions encrypted environment secrets.

### 3. Continuous Delivery Pipeline (`.github/workflows/deploy.yml`)

1. **Pre-flight Quality Gate:** Deployment can only proceed after all 5 CI quality checks (`Quality`, `Security`, `Database`, `Docker`, `E2E`) pass.
2. **Container Build & Tag:** Multi-stage builds generate lightweight, distroless-like production images for `maxr-api` and `maxr-web`.
3. **Database Migration Phase:** Executes forward-only database migrations (`docker compose run --rm migrate`). Migrations are strictly additive and idempotent.
4. **Service Rollout:** Graceful rolling update of `api` and `web` containers.
5. **Post-Deployment Verification:** Automated healthcheck queries `/api/v1/health` and `/healthz`. If either returns non-200, rollout triggers immediate rollback to the previous release image tag.

### 4. Backup, Encryption & Disaster Recovery

- **Daily Automated Backups (`deploy/scripts/backup.sh`):**
  - Scheduled via cron at 02:00 UTC daily.
  - PostgreSQL custom-format dump (`pg_dump --format=custom --no-owner`) piped through AES-256-CBC encryption (`openssl enc -aes-256-cbc -pbkdf2 -iter 200000`).
  - SHA256 checksum generated and stored adjacent to the backup archive.
  - Uploads directory (`/data/uploads`) archived and encrypted in parallel.
  - 35-day local retention cleanup in accordance with ADR D-25.
- **Offsite Redundancy:**
  - Encrypted backup archives mirrored daily to Cantobo private encrypted object storage target.
  - Encryption passphrase stored independently in `/etc/maxr/backup.pass` (mode 0600, root ownership, never included in backup dumps).
- **Automated Restore Drill (`deploy/scripts/verify-restore.sh`):**
  - Validates backup integrity and decryptability by spinning up a temporary isolated database, restoring the schema and data, checking table and migration counts, and tearing it down.
  - Run automatically during database CI tests and scheduled monthly in operations.
  - **SLA:** Recovery Point Objective (RPO) = 24 hours; Recovery Time Objective (RTO) < 1 hour.

### 5. Monitoring & Operational Telemetry

- **Health Probing:** External synthetic monitors ping `/api/v1/health` (5-minute intervals).
- **Host Metrics:** Disk utilization, memory, CPU thresholds, and container restart alerts monitored via Cantobo Server agent.
- **Log Management:** Structured JSON logs containing `requestId` and zero plaintext credentials or sensitive PII.

---

## Consequences

### Positive

- Strict isolation of sensitive workforce data and databases behind an unprivileged edge reverse proxy.
- Predictable, automated deployments with automated rollback on health failure.
- Verified backup restorable guarantee through automated CI and monthly verification drills.
- Fully aligned with OWASP ASVS L2 and ADR D-25 data retention requirements.

### Negative / Trade-offs

- Forward-only migrations require careful schema design (no destructive down-migrations in production without planned restore).
- Initial provisioning requires manual TLS certificate placement and server bootstrapping.
