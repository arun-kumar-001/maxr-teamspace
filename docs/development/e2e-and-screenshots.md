# End-to-End Tests and Responsive Screenshots

Playwright runs the web app in a real browser at the viewports from `AGENTS.md` §8. It lives in `apps/web` (`playwright.config.ts`, `e2e/`).

## Run it
```bash
npm ci
npm run build:shared
npm run e2e:install --workspace=@maxr/web   # once: downloads Chromium
npm run e2e                                 # all tests, starts the dev server itself
npm run screenshots                         # only the 9-viewport run
```
Screenshots are written to `e2e-output/screenshots/<width>x<height>-<tab>.png` (git-ignored). Attach the phone (390) and desktop (1440) images to every UI PR. In CI, the `E2E` job uploads them as the artifact `e2e-screenshots-and-report`.

## What is covered
| Project | Viewport | Specs |
|---|---|---|
| `phone` | 390×844, touch | `gallery.spec.ts` |
| `tablet` | 768×1024, touch | `gallery.spec.ts` |
| `desktop` | 1440×900 | `gallery.spec.ts`, `viewports.spec.ts` (all 9 reference viewports) |

`expectNoHorizontalScroll` (in `e2e/helpers.ts`) fails when the page scrolls sideways **or** any element extends past the viewport outside a scroll container (a clipping ancestor would otherwise hide the bug). Call it in every new page test.

## Write a test for your feature
1. Add `e2e/<feature>.spec.ts`. Use roles and names (`getByRole`), not CSS selectors.
2. Cover the critical flow at all three projects; branch on `test.info().project.name` only where the layout truly differs (cards vs table).
3. Add `await expectNoHorizontalScroll(page)` after each major view.
4. The component gallery (`/components`) only exists in the dev server (`import.meta.env.DEV`); the Playwright config starts the dev server for you.
5. Flows that need the API (login, check-in, leave) will start the API and database in the same config once auth (#7) exists; ask the Technical Lead before changing `playwright.config.ts`.

## Rules
- A bug fix or UI change that affects layout needs the screenshots in the PR.
- Do not weaken a failing check (viewport, scroll or focus) to get green; fix the layout.
- Tests must not depend on real time, network or other tests' data.
