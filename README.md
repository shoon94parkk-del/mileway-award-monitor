# Mileway

Korean Air public **daily** award-seat explorer. Not realtime inventory; counts are flight/date/cabin combinations, not remaining seats. First class public data combines award and upgrade availability.

## Free cloud setup

- GitHub Actions: standard Windows runner, scheduled at 14:27 UTC (23:27 Korea), shortly after the observed 23:00 KST public-data refresh. One route/month per request, 5-second interval, 90-minute maximum. Schedule may be delayed by GitHub.
- The collector retries each failed route/month up to three times with exponential backoff. If the process still stops, the workflow restarts it with `--resume` so already completed route/months from the same source timestamp are skipped.
- Only the Korean Air public award-seat API response is treated as the monitored API. Unrelated Korean Air API failures do not fail a collection.
- Render Static Site: build `node --no-warnings scripts/build-cloud.mjs`, publish `dist`, Node 24. No paid web service, cron job or persistent disk.
- Completed sanitized snapshots live in `public-data/results.json.gz` and `public-data/snapshot.json`. The site reads the current snapshot from public GitHub every five minutes without a Render rebuild. Failed/incomplete collections do not replace it. No Actions artifacts or caches are uploaded.
- Public website supports filtering, calendar, details, comparison and download. Personal favorites/searches and collection administration are intentionally unavailable on the public site. The original local application remains separate.
- The public data screen shows collection health based on the last successful snapshot: green within 36 hours, yellow within 60 hours, red when older.

## Data integrity

- API route, requested month, booking class and calendar month are validated before results are accepted.
- Prestige award class `O` and first-class public `A` are preserved; prestige upgrade class `Z` is intentionally excluded.
- API availability is cross-checked against the rendered public calendar. A mismatch fails that route/month instead of publishing potentially incorrect data.
- Airline `UNQUERYABLE` responses and collector `FAILED` states are never converted into “no seats”.
- Parser regression tests include a representative public API fixture, and CI checks collector/build syntax on pull requests and pushes to `main`.

## Manual run

Actions → Collect public daily award seats → Run workflow. No airline login or credentials are used. Cloud IP access may be rejected by the airline; a deployed website is not evidence the collector works. Check run status, collection-health status and source timestamp. Never bypass authentication or CAPTCHA.

## Limits

Only standard runners on this public repository are intended. Do not switch to a private repository or paid/larger runner. Keep Render spending capped at zero; free quota exhaustion should stop service rather than purchase capacity. Public repository schedules may be disabled after prolonged inactivity. The published snapshot remains available when collection fails.
