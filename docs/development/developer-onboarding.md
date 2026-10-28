# Developer Onboarding: Start Here

Welcome to MAXR Teamspace (MAXR ONE Staff Management). You are joining a project that is **designed but not yet built**: the repository contains rules, requirements and a backlog, and no application code yet. You will build it, issue by issue, under the Technical Lead's (TL) review.

| Person | GitHub | Owns |
|---|---|---|
| Technical Lead | `arun-kumar-001` | Decisions, reviews, merges to `develop` and `main` |
| Developer 1 | `maxrindia29` | Foundation backend (#3–#9, #13, #16), Employee Management (#18–#32) |
| Developer 2 | `maxrindia30-vb` | Foundation UI/ops (#10–#12, #14, #15, #17), Attendance, Leave, Tasks, Meetings (#33–#48) |

## 1. Read in this order (about 90 minutes)
1. `README.md` and this file.
2. `AGENTS.md`: the project rules. **Read all of it.** It is binding for people and AI agents.
3. `docs/requirements/product-baseline.md`: what the product is, what is out of scope, and the open decisions (`D-nn`).
4. `docs/requirements/role-permission-matrix.md`: who can do what. This is the heart of the security model.
5. `docs/architecture/module-inventory.md`: read your own modules closely, skim the rest.
6. `docs/project-planning/developer-work-breakdown.md` and your issues on GitHub.
7. Source of truth for the product: *MAXR ONE Staff Management HLD/LLD Specification v1.0* (ask the TL for the PDF).

## 2. Five rules that matter most
1. **The backend decides access, not the UI.** Every endpoint checks role *and* record scope. Hiding a button is not security.
2. **Do not guess.** If an issue mentions a decision (`D-nn`) that is not closed, comment on the issue and wait. Do not invent business rules.
3. **One issue = one small PR** (aim for under ~400 changed lines). Link it with `Closes #<issue>`.
4. **Responsive from phone to ultrawide monitor** on every screen (`AGENTS.md` §8). Check the 9 reference viewports.
5. **Stay in your lane.** Only edit your own module's folders. Shared files (`AGENTS.md` §12) need the TL's approval.

## 3. Daily workflow (step by step)

**Branches:** `main` (stable) ← `develop` (integration) ← your branch. You never push to `main` or `develop`.

```bash
# one time
git clone https://github.com/arun-kumar-001/maxr-teamspace.git
cd maxr-teamspace
git checkout develop && git pull
```
```bash
# start work on an issue
git checkout develop && git pull
git checkout -b feature/employee-management      # Dev 1, or feature/attendance-collaboration for Dev 2
# foundation issues (#3-#17) use a short-lived branch instead, e.g. global/tl-03-ci
```
```bash
# during work: small, focused commits (Conventional Commits)
git add <files>
git commit -m "feat(employees): add directory list endpoint"
git push -u origin <your-branch>
```
```bash
# before opening the PR: bring in everyone else's work
git fetch origin && git merge origin/develop     # merge, do not rebase
# run the checks (typecheck, lint, tests) - commands arrive with issue #4/#5
```
Then open a **Pull Request: base `develop`**, compare = your branch. Fill in the PR checklist below and request review from `arun-kumar-001`.

**After review:** fix the comments by pushing more commits to the same branch. The TL merges. Never merge your own PR. Never force-push.

## 4. Pull request checklist (paste into every PR)
- [ ] Linked issue (`Closes #n`) and acceptance criteria ticked
- [ ] Backend enforces permission **and** record scope; tests cover allowed, denied and cross-user access
- [ ] Input validated; errors use the standard format; lists paginated
- [ ] Migration included and runs on a clean database; no edits to other owners' tables
- [ ] UI has loading, empty, error, access-denied and validation states
- [ ] Responsive: screenshots at phone (360px) and desktop (1440px+); no horizontal scroll
- [ ] Tests added and passing; lint and typecheck clean
- [ ] Audit log written for sensitive actions; no secrets or personal data in logs
- [ ] Docs updated (`docs/project-status.md`, API docs)

## 5. Order of work
**Both:** do not write feature code until the foundation is merged into `develop`.
- **Dev 1:** #3 (scaffold) first. Nothing else can start before it. Then #4, #5, #6, #7, #8, #9, #13 in dependency order, then Employee Management (#18 onward).
- **Dev 2:** while #3 is in progress, read the docs, install tools, and write down your plan for #10 (design tokens) and #11 (UI components): which components, what states, how they behave at each width. Start coding when #3 is merged. Then #10 → #11 → #12 (the app shell and four role views), then Attendance, Leave and the rest (#33 onward).
- Check each issue's **Dependencies** line. If a dependency is not merged, build against a mock and say so in the PR.

## 6. If you are blocked or unsure
1. Comment on the issue with: what you tried, what you need, and who you need it from. Add the label `blocked`.
2. For a product question, mention `@arun-kumar-001`. Do not choose an answer yourself.
3. Send a short update in the issue at least once a day: *done · doing next · blocked by*.

## 7. Using AI coding assistants (Claude Code etc.)
- The repo includes `AGENTS.md` and project skills in `.claude/skills/` so assistants follow our rules. Tell the assistant to read `AGENTS.md` first.
- You are responsible for every line you submit. Read, run and understand AI-generated code before opening a PR.
- Never paste secrets, real employee data or credentials into an assistant. Do not let an assistant commit or push for you without checking the diff.
- The 21st MCP needs the `API_KEY_21ST` environment variable; ask the TL. Never commit keys.

## 8. Security basics (non-negotiable)
Never commit `.env`, keys, tokens or database dumps. Use parameterised queries only. Do not log passwords, tokens or personal data. Sensitive employee data (ID documents, bank, compensation) needs explicit permission and must not appear in default API responses.

## 9. First day checklist
- [ ] Accepted the GitHub invitation and can open the repo and issues
- [ ] Read `AGENTS.md` and the documents in §1
- [ ] Cloned the repo and checked out `develop`
- [ ] Read your issues and their dependencies
- [ ] Posted a short comment on your first issue: *"Read the docs, plan is …, questions: …"*
