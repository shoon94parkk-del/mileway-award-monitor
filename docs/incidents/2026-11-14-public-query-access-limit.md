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
