# Mileway regression guardrails

Last updated: 2026-11-14

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
- Report measured worker-stage failures accurately; never label the full scan job result as a unit-test outcome.
- An explicit public-source access limit stops source queries and gates browser launches for sixty minutes. Do not move the observation timestamp forward on cooldown skips or count skipped workflows as successful cycles.
- A failed one-browser access check must not start the five-worker matrix. Outbound and return scans must not overlap or cancel each other. Canary output never enters published seat snapshots.
- Run the exact Windows collector preflight suite in Windows CI. Workflow fixture checks must pass with both LF and CRLF; Linux-only success does not verify the production runner.
- Keep the latest measured failure stage visible even when an older access-limit observation remains unresolved for recovery scheduling.
- Passive query diagnostics must retain only bounded allowlisted metadata; raw requests, headers, cookies, browser error text and successful response bodies must not enter reports or logs. Diagnostic failures must not change collection results or prevent browser cleanup.
- Never add page-wide cache headers to public browsing: they can contaminate cross-origin resources. Preserve cache freshness through CDP cache disabling and the navigation URL, using the native browser locale and request headers.

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
