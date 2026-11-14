# Public award query access denied — 2026-11-14

## Evidence

- The November 11 outage followed the airline UI redesign: the legacy `departureBtn` selector disappeared.
- The updated UI collector successfully published all five shards in [run 43125985343](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43125985343) on November 12 at 00:15–00:26 UTC.
- Starting with [run 43232763827](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43232763827), every first route/month stopped at the pre-query form. There was no intervening outbound collector or dependency change.
- [Diagnostic run 43537037118](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43537037118) observed the official UI's public award query return HTTP 403 at **2026-11-14 00:53:03.462 UTC (09:53 KST)**. Waiting ninety seconds did not produce a calendar. Only HTTP status/path metadata was inspected; no response payload supplied award availability.
- Preflight unit tests had passed in the failed collection runs. The workflow incorrectly copied the entire scan-job result into `TESTS_OUTCOME`, producing the misleading public `tests` error.
- The airline page displayed its November 14 01:30 KST source marker. The last verified published seat data remains November 12 01:30 KST. A new page marker does not verify a new seat publication.
- Render's `mileway-hoon` and `mileway-alert-api-hoon` services were live at `ab16858`; the alert API's health/storage check returned HTTP 200.

## Changes

HTTP 403/429 on the public award query now stops the collector, including retry and legacy fallback paths. The incomplete report records `ACCESS_LIMIT`; previous published seats remain intact. Worker outcomes distinguish dependency, test, and collection failure. Public status carries the observed access-limit code and earliest retry time.

Both collection workflows check the latest shared access-limit state before launching browsers. The sixty-minute cooldown remains anchored to the actual denial rather than each skipped attempt. A lightweight hourly GitHub recovery workflow can dispatch the existing collector after the cooldown, while active runs and successful publications retain their existing duplicate protections. Diagnostic browser queries are manual only.

## Verification and limit

Regression tests cover denial detection, late response classification, outcome aggregation, cooldown expiry, skipped-run behavior, and real-scan recovery. The cloud site build and collector syntax checks are required before deployment.

The observed GitHub runner remains denied by the airline. These changes repair detection, reporting, and bounded recovery; they do not establish restored access or fresh seat inventory. Operational recovery requires a subsequent successful full collection and publication. No login, CAPTCHA, session, or access-control bypass was added.

## Follow-up verification at 02:24–02:26 UTC

[Run 43546142771](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43546142771) passed the expired cooldown at 02:24:49 UTC and started all five Windows workers at 02:24:52–53. Each public query again returned HTTP 403. No `OUTBOUND UI` calendar result was logged; the Europe A diagnostic report confirms `coverage=[]`, `rows=[]`, `attempt_complete=false`, and `failure_code=ACCESS_LIMIT`. Those empty arrays describe failed collection and do not establish zero available seats. Publication was skipped. Shared health recorded the latest observed denial at 02:26:03.100 UTC.

The follow-up patch adds a one-browser access check before either five-worker matrix and a shared non-cancelling concurrency group. A blocked check cannot start matrix workers or publish its output as seats. Return-side denial also updates shared cooldown state. Later local dependency or test failures retain outstanding recovery eligibility until a completed full scan. The site labels this state `접근 제한`, preserves the last confirmed data, and reads device alert state from the current production API.

Healthy measured runtimes and post-check estimates are documented in [collection-runtime.md](../operations/collection-runtime.md). The new access check has not yet completed a successful production full scan; its added runtime remains an estimate.

## Follow-up at 14:10 UTC: preflight test portability failure

[Run 43603463237](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43603463237), like the 14:00 run, failed two workflow-contract assertions before the public UI query step. The workflow files had CRLF line endings on Windows, while the tests split and matched LF-only text. This is an internal regression introduced by the earlier mitigation, not a new observation of airline access denial. The last verified HTTP 403 remains the 02:26 UTC observation until a later real query runs.

The fix normalizes fixture line endings, validates unchanged contracts using both LF and CRLF inputs, and adds a dedicated Windows CI preflight job. Public status now distinguishes the current `tests` failure from the retained older access-limit state used for recovery eligibility. The runtime preflight remains enabled; no failed test or source query is treated as success.

### Verification after the portability fix

[CI run 43604488304](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43604488304) passed both the full Ubuntu suite/build (220 tests) and the exact Windows preflight suite (28 tests). The same Windows validation step then passed in [real collector run 43604555166](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43604555166).

That run reached the public award query and observed `ACCESS_LIMIT HTTP 403` at **2026-11-14 14:24:00.826 UTC (23:24 KST)**. The single-browser gate failed, the five-worker matrix and publication were skipped, and shared health recorded a new sixty-minute cooldown ending at 15:24 UTC. This verifies that the internal test regression is fixed and that access denial still prevents actual seat collection. The last-good seat publication remains unchanged.

## Native-header comparison and edge-provider evidence

On 2026-11-14 15:08:49 UTC, [run 43608441256](https://github.com/shoon94parkk-del/mileway-award-monitor/actions/runs/43608441256) still received HTML `ACCESS_DENIED` after the independently reproduced cross-origin header defect was fixed. Safe response classification found an `AKAMAI` edge-provider hint. This narrows the observed refusal but does not identify an IP, region, session, or bot-rule cause. The complete evidence, corrected client behavior, unresolved questions and operator-side resolution steps are in [the analysis](../operations/access-denial-analysis-2026-11-15.md).
