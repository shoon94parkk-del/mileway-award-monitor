# Changelog

## 2026-09-13 — Audit reliability update

Implemented from `Mileway_Audit_Improvement_Plan_2026-09-13` against baseline `a95d745532c294004336c7faf063d84012511251`.

### Fixed

- Canonical alert `region_id` contract fixes Bali/Oceania whole-region alert mismatches while preserving reduced monitoring scope.
- CI no longer assumes all legitimate seat-history transitions are `OPENED`; normal `CLOSED` events remain intact.
- Shared KST collection cycle fixes the pre-23:00 watcher/interlock boundary and adds same-cycle duplicate guards.
- Added explicit public `status.json` separating collector success from airline-source freshness.
- Removed stale recovered error codes from the current public status.
- Completed regions enter a single isolated publication queue immediately rather than waiting for every region to finish.
- Publisher Git operations run in a separate worktree and cannot mutate source files underneath active collectors.
- Prestige is the default visible cabin filter; First/combined modes remain available.
- Export uses the current live publication and active filters instead of the stale Render snapshot copy.
- Status rail now shows current-device Telegram state rather than only global bot configuration.

### Deployment / verification

- Full GitHub CI passed after alert/baseline fixes.
- Full GitHub CI passed after the isolated immediate-publisher refactor.
- Static site and alert API were manually redeployed after Render auto-deploy was observed lagging behind `main`; final Live SHA must still be rechecked after the last documentation/code commit.

### Remaining

- Cross-run route/month checkpoint persistence.
- Coverage-aware `available / unavailable / unknown` notification state.
- Message-level notification outbox and partial-failure idempotency.
- Runtime version endpoints for site/API SHA verification.
- Full multi-device browser QA and 7-day 23:00 operational validation.
