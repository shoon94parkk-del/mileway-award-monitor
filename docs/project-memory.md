# Mileway project memory

Last updated: 2026-09-22

## Product truth
Mileway is a Korean Air public **daily** award-seat explorer. It does not claim realtime inventory and does not expose a remaining-seat count when the source does not provide one. Final availability must be confirmed on Korean Air.

## Current monitored scope
The reduced verified scope is intentional:
- Europe
- Americas
- Oceania: MEL/BNE/SYD/AKL
- Bali: DPS

Collection priority: Europe -> Americas -> Oceania -> Bali.
Do not silently widen this scope during label/region refactors.

## Current production
Hoon_Lap Render workspace:
- Static site: `mileway-hoon` — https://mileway-hoon.onrender.com
- Alert API: `mileway-alert-api-hoon` — https://mileway-alert-api-hoon.onrender.com
- Alert KV/Redis state was migrated with the service so existing alert setup can survive workspace migration.

The old service names in the previous workspace are not the current production target.

## Collection architecture
- `source-watch.yml`: lightweight source watcher.
- `force-2305.yml`: 23:05 KST recovery interlock.
- Cloudflare Worker checks the cycle on a free cron and may dispatch missing GitHub Actions runs.
- Shared KST cycle logic lives in `src/collection-cycle.mjs`.
- Duplicate active collectors are blocked.
- A completed region is published independently through a single-writer path.
- Failed/incomplete regions never replace the last good published region.
- Parallel collection falls back conservatively when 403/429 access limits appear.

Important: scheduled workflow success, collector success, source freshness, publication freshness, and notification success are distinct states.

## Source freshness and public status
`public-data/status.json` is the main public interpretation contract.
Do not call the airline source fresh just because the collector ran successfully.
Fields such as `source_status`, observed/expected source timestamps, collection/publication timestamps, and notification state must remain distinct.

A stale DOM timestamp alone is not absolute proof that every edge/API is stale; guarded collection logic exists for that reason.

## Seat-state integrity
- Prestige public award class `O` and First class `A` are supported.
- Prestige upgrade `Z` is excluded.
- `UNQUERYABLE`/collector errors are not "no seats".
- Legitimate `OPENED` and `CLOSED` change records are both valid.
- Do not delete CLOSED events to satisfy a test; fix the test/model instead.
- Past departures are excluded from normal live search/calendar/stats.

## Alert model
Alerts are private per device and use the Render alert API.
Canonical region IDs are independent of display/source labels:
- `europe`
- `americas`
- `oceania` (source may say 대양주/괌)
- `bali` (source may say 동남아시아/서남아시아 + DPS)

Display-name migrations must not break whole-region alerts.
The status rail represents the current device's Telegram/rule state, not merely global bot availability.

## Mobile UX
- Mobile bottom navigation is kept on one row.
- Home navigation intentionally resets transient search/filter state so users return to a clean Home view.
- Existing saved favorites/alerts are not erased by Home reset.
- Mobile filter/scroll state for ordinary data refresh should not force a full page reload.
- Prestige is the default cabin view.

## Reliability history
Major hardening already implemented:
- source freshness separated from collector success
- 23:05 interlock / duplicate-cycle prevention
- region-level isolated publishing
- current-filter export
- alert region normalization
- Telegram outbox/atomic-claim work and stale-source alert suppression
- Cloudflare watchdog/retry with GitHub Actions backup
- workspace migration to Hoon_Lap with alert API endpoint update
- mobile Home reset and single-row nav

## Verification
- `npm test`
- source syntax checks
- cloud-site build
- actual Render service/commit verification after operational changes
- multi-day 23:00 operational observation remains important for scheduler reliability
