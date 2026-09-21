# Mileway decision log

Append-only high-risk decisions.

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
