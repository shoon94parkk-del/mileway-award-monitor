# Mileway decision log

Append-only high-risk decisions.

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
