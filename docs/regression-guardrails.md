# Mileway regression guardrails

Last updated: 2026-09-22

## Data truth
- Never call Mileway realtime inventory.
- Never invent numeric remaining seats from a boolean/public availability signal.
- Never map `UNQUERYABLE`, stale source, or collection failure to "sold out/no seats".
- Preserve valid `OPENED` and `CLOSED` history events.
- Past departures stay out of normal current search/calendar/stats.

## Scope
- Monitored route scope remains Europe, Americas, Oceania MEL/BNE/SYD/AKL, Bali DPS unless explicitly changed.
- Region label changes cannot silently broaden scope.
- Canonical region IDs must remain stable across UI/source label changes.

## Scheduler/collection
- KST cycle logic remains centralized.
- Duplicate active collectors are blocked.
- 23:05 recovery does not start another successful/active cycle.
- Cloudflare/GitHub recovery checks do not create duplicate heavy collectors.
- A failed/incomplete region cannot overwrite the last good region.
- Collector success and source freshness remain separate.

## Alerts
- Device alert rules/secrets are private and not published.
- Whole-region Bali/Oceania alert matching survives display/source name differences.
- Stale source must not generate false new-seat notifications.
- Partial notification failure should be recoverable rather than silently lost.

## Mobile UX
- Bottom navigation remains a single row.
- Home returns to a clean transient filter/search state.
- Home reset must not delete saved favorites/alerts.
- Ordinary data refresh should not cause unnecessary full-page resets.

## Production
- Current static site: `mileway-hoon.onrender.com`.
- Current alert API: `mileway-alert-api-hoon.onrender.com`.
- Operational completion requires verifying the actual Render Live commit, not only GitHub push success.
