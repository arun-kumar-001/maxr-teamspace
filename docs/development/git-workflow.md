# Git Workflow and Pull Requests

## Branches
| Branch | Who | Rule |
|---|---|---|
| `main` | Technical Lead | Stable releases. Nobody pushes. |
| `develop` | Technical Lead | Integration. Nobody pushes; every PR targets it. |
| `feature/employee-management` | Dev 1 | Employee, user/role admin, settings, expenses |
| `feature/attendance-collaboration` | Dev 2 | Attendance, leave, approvals, notifications, tasks, meetings |
| `global/<issue>` | Dev 1 / Dev 2 | Short-lived foundation work, cut from `develop` |
| `tl/<topic>` | Technical Lead | Technical Lead work |

## Every change
1. `git fetch origin && git merge origin/develop` (merge, never rebase a shared branch).
2. Small commits in Conventional Commit style: `feat(leave): add balance check`.
3. Run the checks from `ci-and-quality-gates.md` locally.
4. Open a PR into `develop`: one issue per PR (under ~400 changed lines), `Closes #<n>`, fill in the template.
5. Fix review comments with more commits on the same branch. Never force-push, never merge your own PR.

## Lockfile rule (CI fails otherwise)
Do not regenerate `package-lock.json` from scratch. If it conflicts or breaks:
```bash
git checkout origin/develop -- package-lock.json
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install
npm run check:lockfile
```
Commit the result only if the check passes.

## Shared files
`.github/CODEOWNERS` lists the files the Technical Lead must approve (`AGENTS.md` §12). Feature PRs must not edit them: open an issue using the "Decision / question" template instead.

## Issues
Use the templates: Task, Bug report, Decision / question. Blank issues are disabled.
