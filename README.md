# Mileway

Korean Air public **daily** award-seat explorer. Not realtime inventory; counts are flight/date/cabin combinations, not remaining seats. First class public data combines award and upgrade availability.

## Free cloud setup

- GitHub Actions: standard Windows runner, scheduled at 00:17 UTC (09:17 Korea). One route/month per request, 5-second interval, 90-minute maximum. Schedule may be delayed by GitHub.
- Render Static Site: build `node --no-warnings scripts/build-cloud.mjs`, publish `dist`, Node 24. No paid web service, cron job or persistent disk.
- Completed sanitized snapshots live in `public-data/results.json.gz` and `public-data/snapshot.json`. The site reads the current snapshot from public GitHub every five minutes without a Render rebuild. Failed/incomplete collections do not replace it. No Actions artifacts or caches are uploaded.
- Public website supports filtering, calendar, details, comparison and download. Personal favorites/searches and collection administration are intentionally unavailable on the public site. The original local application remains separate.

## Manual run

Actions → Collect public daily award seats → Run workflow. No airline login or credentials are used. Cloud IP access may be rejected by the airline; a deployed website is not evidence the collector works. Check run status and source timestamp. Never bypass authentication or CAPTCHA.

## Limits

Only standard runners on this public repository are intended. Do not switch to a private repository or paid/larger runner. Keep Render spending capped at zero; free quota exhaustion should stop service rather than purchase capacity. Public repository schedules may be disabled after prolonged inactivity. The published snapshot remains available when collection fails.
