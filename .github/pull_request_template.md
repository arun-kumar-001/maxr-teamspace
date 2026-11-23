## Summary
<!-- What does this PR change, and why? One issue per PR. -->

Closes #

## How it was verified
<!-- Paste real output from a CLEAN clone: npm ci, typecheck, lint, test, build. -->

```
```

## Checklist
- [ ] Linked issue and its acceptance criteria are ticked
- [ ] Backend enforces permission **and** record scope; tests cover allowed, denied and cross-user access
- [ ] Input validated; errors use the standard envelope; lists paginated
- [ ] Migration included and runs on a clean database; no edits to other owners' tables
- [ ] UI has loading, empty, error, access-denied and validation states
- [ ] Responsive: screenshots at phone (360px) and desktop (1440px+) attached; no horizontal scroll
- [ ] Tests added and passing; CI is green
- [ ] Audit log written for sensitive actions; no secrets or personal data in logs
- [ ] Docs updated (`docs/project-status.md`, API docs)
- [ ] This PR targets `develop` (never `main`)
