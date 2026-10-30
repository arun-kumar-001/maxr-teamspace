# CI and Quality Gates

Every pull request into `develop` or `main` runs the workflow in `.github/workflows/ci.yml`. It has four required checks (Quality, Security, Database, Docker) and one informational check (E2E). **A PR can be merged only when the four required checks are green.**

| Check | What it runs | Blocks the merge when |
|---|---|---|
| **Quality** | lockfile check (`npm run check:lockfile`), `npm ci`, `npm run build`, `npm run typecheck`, `npm run format:check`, `npm run lint`, `npm test` | any of these steps fails |
| **Security** | `npm audit --omit=dev --audit-level=high` and `npm audit --audit-level=high` (dev dependencies too), secret scan (gitleaks over the full history) | any dependency has a high or critical vulnerability, or a secret is found |
| **Database** | PostgreSQL 16 and Redis 7 containers; `npm run db:migrate` twice (second run must apply nothing); `npm run db:seed` twice; then `npm run test:db` (every `*.db.test.ts` against that database) | a migration, seed or database integration test fails |
| **Docker** | shellcheck, production compose validity, API and web image builds, `nginx -t`, container smoke test | an image does not build or the stack does not answer |
| **E2E** (informational) | Playwright at phone, tablet, desktop and the 9 reference viewports; uploads screenshots | not required yet; becomes required after a stable week (issue #62) |

## Tests that need PostgreSQL
Name them `*.db.test.ts` (for example `employees.repository.db.test.ts`). `npm test` skips them, because the Quality job has no database; the Database job runs them with `npm run test:db` after migrating and seeding. Locally: `npm run docker:up && npm run db:migrate && npm run db:seed && npm run test:db`. Files run one after another on the same database, so each test cleans up what it creates (or uses unique values).

## Run the same checks locally before you push
```bash
npm ci
npm run build
npm run typecheck
npm run format:check
npm run lint
npm test
npm audit --omit=dev --audit-level=high
```
Use `npm ci`, not `npm install`: it fails when `package-lock.json` is out of sync, exactly as CI does. If format check fails, run `npm run format`.

## Exceptions
None. Lint and the audit of all dependencies (including dev) are blocking. Do not add exceptions; fix the failure instead.

## Technical Lead setup: branch protection (one-time)
GitHub: **Settings → Branches → Add branch ruleset** (or classic rule) for `develop` and `main`:
1. Require a pull request before merging, with **1 approval**.
2. Require status checks to pass: `Quality`, `Security`, `Database`, `Docker` (add `E2E` after a stable week). Require branches to be up to date.
3. Block force pushes and deletion.
4. (Optional) Require review from code owners, once `CODEOWNERS` exists (issue #14).

The check names appear in the list only after the workflow has run once.

## Notes
- Workflow actions are referenced by major version tags. Pinning to commit SHAs is a later hardening step (issue #16).
- Tests: `npm test` runs every workspace that defines a `test` script. Add Vitest per workspace as features land; CI picks it up automatically.
- The Database job uses throw-away credentials that exist only inside the CI runner. Never put real secrets in the workflow; use GitHub repository secrets.
