# Mileway

Korean Air public **daily** award-seat explorer. It does not claim realtime inventory. A displayed result is a flight/date/cabin combination, not a remaining-seat count, and final availability must be confirmed on Korean Air.

## Current monitored scope

Mileway intentionally monitors the reduced verified scope below:

- Europe
- Americas
- Oceania: MEL/BNE/SYD/AKL
- Bali: DPS

Collection start priority is **Europe → Americas → Oceania → Bali**. Excluded regions are not silently re-added by display-name migration.

## Daily collection architecture

- `source-watch.yml` is a lightweight source watcher, separate from the expensive collector.
- `force-2305.yml` is the 23:05 KST recovery interlock.
- Both use the shared KST cycle calculation in `src/collection-cycle.mjs`; the prewarmed 22:47/22:50 jobs target the upcoming same-day 23:00 cycle rather than the previous day.
- A stale Korean Air DOM timestamp is not treated as proof that the API is stale. After the refresh window, a guarded safety collection can run even if a US edge still serves the previous marker.
- Duplicate active collectors are blocked, and the 23:05 interlock does not start another collector when that cycle already has a successful run.
- Regional collection uses two browser lanes by default. 403/429 access limits stop parallel mode and fall back conservatively rather than increasing concurrency.
- A completed region is queued to one isolated publisher immediately. The publisher uses a separate Git worktree, so Git rebases/pushes never replace source files underneath still-running collectors.
- Failed or incomplete regions never replace the last good published region.

GitHub scheduled workflows can still start late; schedule success, collection success, fresh airline source and notification success are separate states.

## Public operating state

`public-data/status.json` is the public status contract. Important fields include:

- `cycle_id`
- `collector_status`
- `source_status`
- `expected_source_at` / `observed_source_at`
- `last_successful_collection_at`
- `last_fresh_publication_at`
- `publication_id`
- `notification_status`
- region status records

The UI must not call stale airline source data “normal” just because a collection process completed successfully. `source_status=delayed` is displayed separately from collector health.

`public-data/health.json` remains an operational compatibility file; `status.json` is the preferred public interpretation layer.

## Public-site UX

- Past departures are excluded from normal search/calendar/stats while saved historical items can remain visible in their saved context.
- Prestige is the default visible cabin filter. Users can switch to Prestige + First or First only.
- Region, destination, month/date, weekend, cabin and sort are shared by the active filter summary.
- The download button exports the **current live publication and current filters**, not a stale Render copy of `/snapshot.json`.
- Mobile filter state and scroll position are preserved without forcing a whole-page reload for ordinary data refreshes.
- The status rail separates **collection / airline source / current result / my alerts**.

## Seat alerts

Alerts are private per device and delivered through the Render alert API. Do not put user rules or secret values in the public repository.

Canonical region IDs are independent of display/source labels:

| region_id | Display | Source examples |
|---|---|---|
| `europe` | 유럽 | 유럽 |
| `americas` | 미주 | 미주 |
| `oceania` | 오세아니아 | 대양주/괌 |
| `bali` | 발리 | 동남아시아/서남아시아 + DPS |

Legacy `발리`, `오세아니아`, `대양주/괌` rules are normalized to the canonical IDs. This prevents whole-region Bali/Oceania alert misses while keeping the intentionally reduced route scope.

The status rail shows the **current device's** Telegram link/rule state, not merely whether the global bot exists.

## Data integrity

- Prestige award class `O` and public First class `A` are preserved; Prestige upgrade class `Z` is excluded.
- `UNQUERYABLE` and collector failures are never converted to “no seats”.
- Incomplete collections cannot replace a completed published region.
- Both legitimate `OPENED` and `CLOSED` history events are supported; CLOSED events are not deleted to make CI green.
- Publication uses a single writer for Git/public-data updates.

## CI and deployment

CI runs all unit tests, source syntax checks and a complete cloud-site build. A GitHub push alone is not treated as production completion.

Render services:

- Static site: `mileway-award-monitor`
- Alert API: `mileway-alert-api`

After an operational change, verify the actual Render Live commit because auto-deploy has previously lagged behind `main` even while configured as enabled.

## Manual collection

Actions → **Collect public daily award seats** → **Run workflow**.

The collector uses only Korean Air's public daily award-seat source. No airline login, CAPTCHA bypass or authentication circumvention is used.

## Known work still in progress

- Persisting route/month checkpoints across separate GitHub runner executions.
- Coverage-aware `available / unavailable / unknown` alert state so an unqueryable gap never creates a false reopen notification.
- Message-level notification outbox/atomic claim for partial Telegram delivery failures.
- Full device-size browser QA and 7-day 23:00 operational validation.
