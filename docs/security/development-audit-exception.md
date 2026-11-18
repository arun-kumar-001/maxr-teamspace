# Temporary development dependency audit exception

TL authorization: 2026-11-18, after disclosure of the failed Security job and a request to proceed with PR/main merge and server deployment. Expires **2026-12-02 00:00 UTC**. Remove earlier when an upstream compatible fix is published.

Only [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) is excepted: picomatch repeated-extglob ReDoS, affecting published versions through 4.0.7 with no patched release at approval time. The production audit is clean and remains unchanged. This exception applies only to lockfile entries marked dev-only and their dev-only affected dependency chains. New advisories, production exposure, critical severity, malformed reports and expiry still fail Security CI.

Do not expose development servers to untrusted users or accept arbitrary user-supplied glob patterns in development tooling. Builds use repository-controlled patterns. Recheck the upstream advisory before extending this exception; a permanent severity-threshold reduction is not authorized.

Implementation: `scripts/check-audit.mjs`; regression coverage: `node --test scripts/check-audit.test.mjs`. All production high/critical findings remain blocking under the original `npm audit --omit=dev --audit-level=high` gate.
