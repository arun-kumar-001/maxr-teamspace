# Module Template Exercise

`apps/api/src/modules/_template/` is a working sample module. Use it as the starting point for every backend module and as a self-check that your setup works.

## What it shows
`template.routes.ts` → `template.controller.ts` (HTTP only) → `template.service.ts` (rules, transaction, audit, events) → `template.repository.ts` (SQL only), with Zod schemas in `template.schemas.ts`, types in `template.types.ts`, OpenAPI entries in `template.openapi.ts` and an end-to-end test in `template.e2e.test.ts`. Read `_template/README.md` and `docs/architecture/api-conventions.md` first.

## Exercise (about 1 hour)
1. Complete `local-setup.md` (Docker up, migrate, seed).
2. Run the template tests: `npm test --workspace=@maxr/api`.
3. Copy the folder to `apps/api/src/modules/<your-module>/` and rename the files.
4. Replace the sample entity with yours, keeping: authenticate → authorize (role and record scope) → validate → execute; paginated lists; the standard error envelope.
5. Register the routes in `apps/api/src/routes/index.ts` and regenerate the OpenAPI file; the sync test fails if you forget.
6. Write tests for allowed, denied and cross-scope access. Run all checks in `ci-and-quality-gates.md`.

If any step fails because the docs are wrong or unclear, open a "Decision / question" issue or fix the doc in your PR.
