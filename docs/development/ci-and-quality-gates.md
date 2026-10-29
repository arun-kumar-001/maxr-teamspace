# CI and Quality Gates

Every pull request into `develop` or `main` runs the workflow in `.github/workflows/ci.yml`. It has three required checks. **A PR can be merged only when all three are green.**

| Check | What it runs | Blocks the merge when |
|---|---|---|
| **Quality** | `npm ci`, `npm run build`, `npm run typecheck`, `npm run format:check`, `npm run lint`, `npm test` | any of these steps fails |
| **Security** | `npm audit --omit=dev --audit-level=high`, secret scan (gitleaks over the full history) | a production dependency has a high or critical vulnerability, or a secret is found |
| **Database** | PostgreSQL 16 and Redis 7 containers; `npm run db:migrate` twice (second run must apply nothing); `npm run db:seed` twice | a migration or seed fails on a clean database. The steps start automatically once the migration runner (issue #4) is merged |

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

## Temporary exception (tracked in issue #52)
| Step | Why it is non-blocking now | When it becomes blocking |
|---|---|---|
| Audit of dev dependencies | `vite` has a high vulnerability (#52, F7) | In the PR that closes #52: delete `continue-on-error` on that step |

Lint became blocking once the ESLint setup was fixed (PR with the local environment). Do not add new exceptions. Fix the failure instead.

## Technical Lead setup: branch protection (one-time)
GitHub: **Settings → Branches → Add branch ruleset** (or classic rule) for `develop` and `main`:
1. Require a pull request before merging, with **1 approval**.
2. Require status checks to pass: `Quality`, `Security`, `Database`. Require branches to be up to date.
3. Block force pushes and deletion.
4. (Optional) Require review from code owners, once `CODEOWNERS` exists (issue #14).

The check names appear in the list only after the workflow has run once.

## Notes
- Workflow actions are referenced by major version tags. Pinning to commit SHAs is a later hardening step (issue #16).
- Tests: `npm test` runs every workspace that defines a `test` script. Add Vitest per workspace as features land; CI picks it up automatically.
- The Database job uses throw-away credentials that exist only inside the CI runner. Never put real secrets in the workflow; use GitHub repository secrets.
