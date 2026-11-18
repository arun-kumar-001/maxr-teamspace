# Employee Directory selective integration — 2026-11-18

The TL approved only the Employee Directory design from Venkat PR #169 at `88d60ae`. The local page now uses its desktop card layout, name/ID search, list/grid switcher and employee action popup. Existing advanced filters remain available in a collapsed Filters section. Tablet header wrapping, touch targets and pending-status labels were corrected during integration.

The existing directory API client, hook, authorization and error handling are retained. Sample employees, invented photos, employment types and default phone numbers were excluded. Missing phone numbers show Not provided. The Staff Dashboard, Projects, other PR modules and migrations were not imported.

Verification for the local working-tree revision on `codex/hr-leave-approval`:

- `EmployeeDirectoryPage.test.tsx`, `EmployeeDirectory.test.tsx` and `useEmployeeDirectory.test.ts`: 25 passed before the additional data-accuracy assertion; the changed page file then passed all 11 tests, for 26 distinct passing tests across these files.
- `employee-directory-design.spec.ts`: three mocked-API browser scenarios passed on phone, tablet and desktop after fixing tablet header overflow. Checks cover cards, pending status, search/clear, empty state, list/grid switching, popup/Escape behavior and horizontal overflow. Phone/desktop screenshots were inspected.
- Web `tsc --noEmit`, scoped ESLint, Prettier and `git diff --check` passed. The final header/touch-target edits were styling only.
- Pre-existing uncommitted changes were preserved: excluding the three directory-specific files, their before/after content hash remains `14739245325cb07ac26a927910cc475a0c94b7ba5d69ad4f0913b8a68b4371b1`.

The integrated page is served by the main local app on port 3000. Port 3001 remains the separate full-PR design preview. No commit, push, GitHub PR merge or server deployment was performed as part of this selective local integration.
