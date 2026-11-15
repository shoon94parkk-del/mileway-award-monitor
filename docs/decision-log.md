# Mileway decision log

Append-only high-risk decisions.

## 2026-11-15 — Observe the existing public query before changing request behavior

The original successful collector and the standard installed-Chrome collector both failed later. Code review did not establish an airport/month selection defect. Add passive, bounded diagnostics to the existing one-query canary to distinguish preceding page/resource failures and request-field mismatches from the observed refusal. Record only fixed phase/error/resource classifications, capped counts, HTTP statuses and equality booleans for the known outbound request fields. Never log raw requests, cookies, tokens, URLs, browser error text, or successful response bodies. Diagnostic observation does not change networking, session creation, UI clicks, denial stop behavior or publication eligibility. Run the same diagnostic tests in Windows preflight; actual calendar and publication evidence remain necessary before recovery is claimed.

## 2026-11-15 — Replay the successful November 12 run without collector changes

The user explicitly requested the November 12 successful setup, so rerun all jobs of `43125985343` at its original SHA `31e4bb17` as attempt 2. Confirm the original workflow, source, five route partitions, image, Node/npm/Playwright and commands rather than approximating them with current code. All five workers passed their fourteen tests and then failed the first route/month twice without a verified result calendar; publication was skipped. The legacy code does not emit HTTP-denial diagnostics, so do not attribute a newly measured 403 to this attempt. Its status job incorrectly passes the overall scan failure as the test outcome; correct the resulting public `last_error_step` to `collection` using the measured step results, retaining the actual earlier denial timestamp and last-good publication. Keep the current production collector and its guards unchanged.

## 2026-11-15 — Preserve native browser headers for public resources

The public-navigation helper injected `Cache-Control` and `Pragma` into every browser request. Retained browser logs showed third-party scripts/fonts/fetches failing CORS preflights for these headers. A two-origin local browser reproduction confirmed the defect: the old helper sent an unsupported OPTIONS preflight and failed; with native request headers, the same resource loaded through a normal GET.

Remove page-wide extra headers. Retain the Chromium cache-disabled setting, cache-busted navigation URL, Seoul timezone, public UI route selection, and access-limit stop behavior. This fixes the demonstrated resource-loading defect; it does not by itself prove why a particular airline query was denied. The same polluted client also had a historical successful query, so verify the updated client through one ordinary public canary before claiming restored access.

Windows CI and runtime preflight now include navigation and denial-observer tests. Safe denial diagnostics may identify a known edge-provider marker, but generic HTML/403 remains unattributed and no vendor hint establishes an exact blocking rule.

## 2026-11-14 — Explicit immediate manual retry, with bounded denial diagnostics

After the current cooldown was explained, the user explicitly requested an immediate rerun. `workflow_dispatch` therefore has an optional `retry_now` input, false by default. Only an explicit manual dispatch can skip the local waiting period; scheduled and push-triggered runs retain it. This does not skip the single-browser check, permit failed queries to publish, or change any airline request/access mechanism.

For the next received 403/429 only, collect a bounded safe diagnostic: HTTP status, allowlisted content type, response format, and a conservative error-kind enum. Inspect at most a 16 KiB error envelope and wait at most one second before browser teardown. Never store or log raw error bodies, cookies, tokens, or availability data. A response format alone does not identify the refusing system.

## 2026-11-14 — Verify the Windows preflight on Windows

Runs `43602576432` and `43603463237` failed before querying the airline. Two workflow-contract tests introduced with the single-browser access check parsed raw YAML with LF-only regular expressions; Windows checkouts used CRLF, so the assertions failed even though the workflow gates were present. Normalize fixture line endings and exercise the same full contract against both LF and CRLF. Keep the contract assertions intact.

CI now runs the exact four-file collector preflight suite on a Windows runner as well as the full Ubuntu suite/build. This job does not launch a browser or contact the airline. An older unresolved access-limit observation can keep recovery eligible, but public status must show the latest measured preflight test failure as `tests`, separately from that old access state. Only an actual completed scan/publication establishes recovery.

## 2026-11-14 — A real denied retry is not a completed search

Verification run `43546142771` started at 02:24:40 UTC after the cooldown expired. All five Windows workers reached the public source and received HTTP 403 on their first award query; no route/month result was collected and publication was skipped. Keep the current state failed and the last-good seat data intact. A lightweight recovery job succeeding means only that it dispatched or deferred work.

Subsequent full scans require a one-browser public UI access check before the five-way matrix. Outbound and return workflows share a non-cancelling concurrency group so they cannot create ten simultaneous airline-query browsers. The access check uses the same route selection and rendered calendar, never another host, credential, or bypass. Display access denial distinctly from generic collection failure. Device alert state must be read from the current `mileway-alert-api-hoon` production service.

Measured healthy runtime, concurrency evidence, and estimates are recorded in `docs/operations/collection-runtime.md`; access-denied collection has no verified completion ETA.

## 2026-11-14 — Respect public-source access limits with a bounded cooldown

An explicit public collection report `failure_code=ACCESS_LIMIT` is preserved separately from the failed stage, with its observed timestamp. Public status reports `ACCESS_LIMIT` and a retry time sixty minutes after that observation. Both outbound and return workflows check the latest shared health before starting browsers; an active cooldown fails preflight rather than producing a green collection cycle. Skipped scans and successful source watchers do not clear the failure or advance its timestamp. The gate automatically permits collection after sixty minutes; only a completed successful scan establishes recovery. Last-good seats and source freshness remain independent of this access state.

## 2026-11-14 — Collection errors reflect measured runner stages

Five-runner outbound job failures no longer imply failed unit tests. Each runner records only its worker id and dependency/test/collection step outcomes in a short-lived artifact; the status job aggregates all five. Missing evidence leaves dependency/test outcomes unproven and preserves the overall collection failure instead of inventing a test result. Failed outbound/return runs retain only public collection reports and diagnostics as short-lived artifacts; credentials and private alert state are excluded. Source freshness, last-good publication, and notification checks remain independent.

## 2026-11-11 — Europe → ICN return exploration, isolated from outbound

User-requested direction expansion is implemented as an isolated daily browser collector + independent return report and new site page. The verified list of European outbound destinations is reused only as a list of European departure candidates; live Korean Air UI must confirm reverse-origin selectability. API requests must be verified as origin=European airport, destination=ICN and consistent with the public UI before direct acceleration. UNQUERYABLE is never no-seat; failures cannot overwrite a successful snapshot. Return Telegram alerts are intentionally not yet wired and must not be inferred from outbound alert coverage.

## 2026-09-22 — Durable project memory
Added repository-level rules, memory, guardrails, and regression contract so scheduler/source/alert fixes are not later reverted.

## 2026-09-21 — Move production to Hoon_Lap
Static site and alert API were migrated to the Hoon_Lap Render workspace as `mileway-hoon` and `mileway-alert-api-hoon`. Client/service-worker endpoints and portable alert encryption were updated so existing alert devices could recover after migration.

## 2026-09-21 — Home reset navigation
Home navigation intentionally clears transient search/filter state for a clean Home view while preserving saved data. Mobile navigation remains one row.

## 2026-09-17 — Free watchdog + GitHub backup
A Cloudflare Worker checks for same-cycle success and dispatches missing Actions runs with bounded retries. Heavy collection must not be duplicated; GitHub cron remains a backup.

## 2026-09-13 — Source freshness is not collector success
A successful collection can still be based on stale upstream source data. Public status therefore keeps collector health, source freshness, publication freshness, and notification state separate.

## 2026-09-13 — Preserve CLOSED events
Valid history includes both OPENED and CLOSED. When a test assumed every event was OPENED, the test/model was the bug; valid CLOSED data must not be removed.

## 2026-09-13 — Canonical alert region IDs
UI/source display names differ for Bali/Oceania. Alerts use canonical region IDs so label changes do not break region-wide matching.

## 2026-09-01 — Public daily scope and no seat-count guessing
The system uses public Korean Air daily award data without login/circumvention. A result means availability was observed for flight/date/cabin; it is not a numeric seat-count claim.
