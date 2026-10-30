# ADR D-08: Report Export Formats & PDF Library

- **Status:** Proposed (awaiting Technical Lead approval)
- **Deciders:** Technical Lead (`arun-kumar-001`), pending
- **Date:** 2026-10-30
- **Context:** [Product Baseline §10 (D-08)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [reports.md](../reports.md), issue #15, [AGENTS.md §2](../../../AGENTS.md)

---

## Context and Problem Statement

The specification text asks for report export as CSV and PDF; Figure 1 mentions PDF and Excel. CSV is built and merged (RFC 4180, formula-injection safe, audited, capped at 10,000 rows). PDF needs a library, and AGENTS.md §2 says no library is added without an ADR.

Requirements that shape the choice:

- **Tabular reports** (employee, attendance, leave, task lists): many rows, repeated header row, page numbers, landscape pages.
- **Tamil names and text** must render correctly: the company is in India and employee names appear in Tamil script. This needs real text shaping, not just a font with the glyphs.
- **Runs inside the API container** (Docker, Node 22, `read_only` root filesystem, small image). No browser, no native system packages.
- **Security:** report data is untrusted text; the generator must not fetch URLs or read arbitrary files. Exports stay audited and scope-filtered by the existing report service.
- **Maintained, permissively licensed, no new `npm audit` findings.**

## Decision Drivers

1. Correct Tamil shaping and a table layout out of the box (less code to own).
2. No headless browser or system packages in the production image.
3. Bounded CPU and memory per export.
4. Small, well-known dependency tree and MIT/Apache licensing.

## Options Considered

| Option                                        | Verdict         | Why                                                                                                                                             |
| --------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **pdfmake 0.3** (built on pdfkit and fontkit) | **Recommended** | Declarative tables with repeated header rows, headers/footers with page numbers, pure JavaScript, MIT. Spike below shows correct Tamil shaping. |
| pdfkit alone                                  | Rejected        | Same engine, but we would write and maintain our own table layout, pagination and header repetition.                                            |
| @react-pdf/renderer                           | Rejected        | Heavier (layout engine and React renderer), aimed at designed documents, not long data tables.                                                  |
| Puppeteer / headless Chromium (HTML to PDF)   | Rejected        | Adds a browser (hundreds of MB, system libraries, sandbox flags) to the API image and a large attack surface for a data-only need.              |
| jsPDF                                         | Rejected        | Browser-first; weak on complex scripts and long tables.                                                                                         |
| External PDF service                          | Rejected        | Sends personal data to a third party; no basis in the spec.                                                                                     |

## Decision (proposed)

Use **pdfmake `0.3.x`**, pinned to an exact version, for the PDF exporter, behind the existing `format` parameter of `GET /reports/{name}/export`.

Guardrails that come with the decision:

1. **Fonts are bundled, never fetched.** Inter (Latin) and Noto Sans Tamil, both under the SIL Open Font License, committed as font files or taken from the `@fontsource` packages. Text in a cell uses the Tamil font when it contains Tamil script.
2. **Access policies set to deny:** `setUrlAccessPolicy(() => false)` and a local-access policy that allows only the bundled font directory. The report definition is data only (`columns` and rows); no user-supplied HTML, images or document structure ever reaches pdfmake.
3. **PDF row cap of 2,000** (CSV stays at 10,000). Larger requests answer `422` with "use CSV or narrow the filters", like the existing cap.
4. **Generation runs in a `worker_thread`**, so layout work never blocks the API event loop. One export per user at a time; a global limit of 2 concurrent PDF jobs, extra requests wait or get `429`.
5. **Same controls as CSV:** `reports.export` permission, scope applied in the query, column whitelist, and the audit entry (`report.export`, format `pdf`, row count, filter names) written before delivery and failing closed.
6. Exact version pinned; the Security job (`npm audit`) stays the gate.

## Spike evidence (2026-10-30, Node 22, scratch project outside the repo)

| Check                                                 | Result                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tamil text with the Noto Sans Tamil font              | Shaped correctly (conjuncts and vowel signs rendered as expected) in a mixed Latin/Tamil table                                          |
| 120 rows, landscape A4, repeated header, page numbers | 4 pages, 31 KB, 0.45 s                                                                                                                  |
| 2,000 rows                                            | 1.6 s, 341 KB, about 145 MB RSS                                                                                                         |
| 10,000 rows                                           | 6.2 s, 1.7 MB, about 264 MB RSS (event-loop blocking if run in-process, which is why the cap is 2,000 and generation moves to a worker) |
| `npm audit` on the spike install                      | 0 vulnerabilities                                                                                                                       |
| Dependencies                                          | pdfmake 0.3.13 (MIT) with pdfkit 0.20.2 (MIT) and fontkit                                                                               |

## Consequences

**Positive:** Tamil and tables work with little code; no browser; the existing report service, audit and scope rules are reused unchanged; PDF becomes one more exporter.
**Negative:**

- About 25 MB more in `node_modules`, and two font files (about 100 KB each) in the image.
- CPU-bound generation needs the worker thread and the 2,000-row cap.
- Other Indic scripts beyond Tamil are not verified; add a spike per script if the business needs them.
- pdfmake 0.3 changed its API from 0.2; we pin the version and wrap it in one small adapter so a later swap is local.

## Implementation plan (after approval, issue #15)

1. Add the dependency and the fonts; `pdf-exporter.ts` adapter with the access policies and worker thread.
2. Extend `ReportService.export` with `format=pdf`, the 2,000-row cap and the audit metadata.
3. Tests: Tamil sample renders (text extraction check), cap and 422, audit entry and fail-closed, permission and scope per role, no outbound URL or file access.
4. Update `docs/architecture/reports.md`, OpenAPI and the decisions log.

## Open questions for the Technical Lead

- Approve pdfmake and the guardrails above?
- Is a PDF row cap of 2,000 acceptable, or should large PDFs wait for the async export job infrastructure?
- Are scripts other than Tamil and Latin needed?
