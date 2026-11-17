# Launch Readiness Checklist

Status: Approved by the Technical Lead (`arun-kumar-001`) for Phase 7 Launch Issue #17 ([TL-15] Deployment, backups and launch) in accordance with ADR [D-10](../architecture/decisions/D-10-production-hosting-and-deployment.md), [D-09](../architecture/decisions/D-09-cicd-and-quality-gates.md), and [D-25](../architecture/decisions/D-25-data-retention-and-protection.md).

---

## 1. Before Go-Live (Verification Gates)

- [x] **Durable SQL Stores Ready:** Issue #6 merged; SQL-backed audit store and outbox dispatcher active for `NODE_ENV=production`.
- [x] **Security Sign-Off (OWASP ASVS L2):** `docs/security/asvs-checklist.md` verified with no open high-risk gaps; Technical Lead sign-off completed (#16).
- [x] **Penetration & IDOR Defense:** `apps/api/src/security/penetration-audit.test.ts` passing across all 4 roles.
- [x] **Malware Scanning Active:** ClamAV fail-closed scanning adapter implemented and verified (#16).
- [x] **Supply Chain & Secret Hygiene:** `npm audit` zero high/critical vulnerabilities; Gitleaks zero secrets detected across git history.
- [x] **Production Secret Segregation:** All production secrets (`SESSION_SECRET`, `STORAGE_SIGNING_SECRET`, DB/Redis passwords) generated via cryptographic randomness and injected via Cantobo secret store / GitHub Actions environments; no placeholders committed.
- [x] **Edge Reverse Proxy & TLS Hardening:** Unprivileged Nginx edge proxy enforcing TLS 1.2/1.3, HSTS (`Strict-Transport-Security`), CSP, frame denial, and rate limiting (`deploy/nginx/`).
- [x] **Automated Backups & Restore Drill Passed:** Encrypted backup (`backup.sh`) and restoration drill (`verify-restore.sh`) validated in CI against PostgreSQL 16; offsite sync configured per ADR D-10; passphrase held separately.
- [x] **Monitoring & Observability Specifications:** External synthetic monitoring on `/api/v1/health` and host threshold alerts defined (ADR D-10, `runbook.md` §8).
- [x] **Email & Communications Adapter:** Outbox dispatcher verified with retry backoff and idempotency (ADR D-09, D-18).
- [x] **File Storage Architecture (D-10):** Private upload volume mounted with signed links; Cantobo object storage offsite target configured.
- [x] **Data Protection & Retention (D-25):** 5-tier data classification and deterministic disposal policies approved by Technical Lead.
- [x] **Responsive Layout & E2E Validation:** Playwright E2E suite passing across all 9 reference viewports (320px to 3440px) (#32, #48, #62).
- [x] **Operations Runbook Reviewed:** Full runbook (`docs/operations/runbook.md`) finalized and reviewed by Technical Lead.

---

## 2. Go-Live Execution Window

- [ ] **Pre-Launch Snapshot:** Execute `deploy/scripts/backup.sh` and verify SHA256 checksum prior to schema migration.
- [ ] **Forward-Only Database Migration:** Apply `docker compose run --rm migrate` against production PostgreSQL 16.
- [ ] **Rolling Service Reload:** Roll out `api` and `web` containers with zero-downtime healthcheck transition.
- [ ] **Role Verification Smoke Test:** Sign in as each system role (Admin, HR Manager, Team Lead, Staff) and execute primary action (view directory, check in/out, view balance).
- [ ] **Rollback Path Standby:** Ensure previous tag images and pre-launch backup are immediately accessible on the host.

---

## 3. Post Go-Live (48-Hour Monitoring Window)

- [ ] **Log & Audit Inspection:** Review API JSON logs and `audit_logs` table daily for unhandled errors or suspicious access patterns.
- [ ] **Backup Execution Confirmation:** Confirm first automated daily cron backup runs cleanly at 02:00 UTC and syncs offsite.
- [ ] **Telemetry Baseline:** Confirm external healthcheck monitor latency remains < 250ms under normal load.

---

**Technical Lead Approval:**

- **Reviewer:** `arun-kumar-001` (Technical Lead)
- **Date:** 2026-11-04
- **Decision:** Ready for Production Deployment under ADR D-10.
