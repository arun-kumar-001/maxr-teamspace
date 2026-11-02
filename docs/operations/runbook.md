# Operations Runbook (draft)

Status: repo-side half of issue #17, written by the Technical Lead. The Cantobo-specific steps (hosting, deploy pipeline, staging, monitoring) are open until decision **D-10** is answered and are marked **[D-10]**.

## 0. Known blocker
The API refuses to start with `NODE_ENV=production` until the SQL-backed audit and outbox stores exist (issue #6, Dev 1). Everything below is built and tested (images, Nginx, backups), but a real production start is not possible before #6 is merged. CI therefore boots the image in development mode.

## 1. What runs where
| Container | Image | Exposed | Notes |
|---|---|---|---|
| `web` | `deploy/Dockerfile.web` (unprivileged Nginx + built SPA) | 80 → 8080 (redirect), 443 → 8443 (TLS) | TLS, rate limits, security headers, `/api/v1/*` proxy |
| `api` | `deploy/Dockerfile.api` (Node 22, non-root, read-only filesystem) | internal 4000 | `TRUST_PROXY=1`, health check on `/api/v1/health` |
| `postgres` | `postgres:16-alpine` | internal only | volume `postgres_data` |
| `redis` | `redis:7-alpine` | internal only, password required | volume `redis_data` (cache/sessions only, never source of truth) |
| `migrate` | same image as `api` | none | one-shot, profile `ops` |

Uploads live in volume `uploads_data` (private, served only through signed links by the API).

## 2. First-time setup
1. Install Docker Engine with Compose v2 on the host. Open ports 80 and 443 only.
2. `cp deploy/.env.production.example deploy/.env.production` and fill every empty value. Generate secrets with `openssl rand -base64 48 | tr -d '\n'`. Never reuse development placeholders (the API rejects them).
3. Put the TLS certificate chain and key in `TLS_CERT_DIR` as `fullchain.pem` and `privkey.pem` (for example from Let's Encrypt or the company CA). Mode 600 for the key, owned by root; the container reads them read-only.
4. Start: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build`
5. Apply migrations: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm migrate`
6. Check: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps` (all `healthy`) and `curl -fsS https://<host>/api/v1/health`.

## 3. Release (update)
1. Tag the release on `main`; on the host `git fetch && git checkout <tag>`.
2. Take a backup (section 5) **before** migrating.
3. `docker compose ... up -d --build` then `run --rm migrate`. Migrations are forward-only; never edit an applied one.
4. Verify health and sign in as one user per role.
5. Roll back: check out the previous tag and `up -d --build`. If a migration must be undone, restore the pre-release backup (section 6); there is no automatic down-migration.

## 4. Logs
`docker compose ... logs -f api web`. API logs are JSON with a `requestId`; Nginx logs the same id (`rid=`), never query strings or bodies. Logs are redacted at write time; do not paste them into tickets unreviewed.

## 5. Backups
Scripts: `deploy/scripts/backup.sh`, `restore.sh`, `verify-restore.sh`. Backups are AES-256 encrypted with a passphrase file; keep the passphrase **outside** the backup location (a lost passphrase means unrecoverable backups).
```bash
export PGUSER=maxr PGDATABASE=maxr_teamspace
export PG_EXEC="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production exec -T postgres"
export BACKUP_DIR=/var/backups/maxr BACKUP_PASSPHRASE_FILE=/etc/maxr/backup.pass
export UPLOADS_DIR=/var/lib/docker/volumes/<project>_uploads_data/_data   # optional
deploy/scripts/backup.sh
```
Schedule daily with cron (`0 2 * * * ...`), keep 35 days (`BACKUP_RETENTION_DAYS`), and copy the directory off the host **[D-10: where]**. Proposed retention and the data classes are in `docs/security/data-protection-and-retention.md` (D-25).

## 6. Restore and restore drill
- **Drill (run monthly and before launch, and record the result):** `deploy/scripts/verify-restore.sh <backup-file>` restores into a throw-away database, checks tables and applied migrations, drops it. Exit code 0 means restorable.
- **Real restore (destructive):** stop `api`, then `CONFIRM=yes deploy/scripts/restore.sh <backup-file>`, restore uploads from the matching archive, start `api`, verify.
- Target recovery points to agree with the business owner: RPO (maximum data loss) 24 h with daily backups; RTO (time to restore) to be decided.

## 7. Incidents (first response)
| Symptom | Check |
|---|---|
| Site down | `ps` for unhealthy containers; `logs web`; certificate expired? |
| 502 from Nginx | `api` unhealthy: `logs api`; database or Redis down; migration pending |
| API restarts in a loop | Missing or placeholder secret (the boot error names the variable); Postgres not reachable |
| 429 for many users | Nginx rate limit (`limit_req`) or API limiter; behind a shared NAT raise the limit deliberately |
| Suspected leak | Rotate `SESSION_SECRET` (signs out everyone), `STORAGE_SIGNING_SECRET` (invalidates download links), DB and Redis passwords; review the audit log |

## 8. Monitoring and alerts **[D-10]**
Not built yet. Minimum before launch: external uptime check on `/api/v1/health`, disk space alert on the Docker host, certificate expiry alert, failed-backup alert (cron mail), container restart alert.
