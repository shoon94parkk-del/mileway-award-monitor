# Worldwide follow-up — 2026-09-10

## Latest override: regional immediate publication

Final local verification: npm test 34/34 passed, cloud build passed (existing 92 combinations / 26 routes), modified orchestrator and generated regional-status/cloud-enhancements syntax checks passed, git diff --check passed. git diff --exit-code -- public-data confirmed no production-data modifications. No remote upload succeeded and no deployment was performed.

User now explicitly wants Europe completed -> publish immediately, Americas completed -> publish immediately, Oceania, Asia. This overrides all-worldwide-before-publication statements below. New --group flag marks REGION scope; only a complete validated region may replace that region. mergeCompletedRegion preserves all other region observations and their real source timestamps. Coverage is source-specific; app-store query now matches destination/month/source rather than a single global source. Composite report exposes region_status, mixed_sources, worldwide_complete, publication_id. Regional status UI shows region timestamps; snapshot refresh reacts to publication_id even on the same airline day.

scripts/collect-regions.mjs is the GitHub-only publishing orchestrator. It sequentially collects each group (bounded retry/resume), validates/merges, builds, then commits/pushes immediately before the next group. Publication staging failure restores only three known files from in-memory backups. No force push; external branch race stops publishing. Workflow now uses this script. Individual region failure retains old data and continues next group; access-limit exit 75 stops. Notifications currently run after the regional loop, not immediately after every group. Region-only successful publication is allowed; incomplete region publication is not.

These changes remain LOCAL ONLY pending Edge upload permission. No regional GitHub run or live deployment has been verified. Tests added for preserving America while updating Europe and refusing incomplete/failed regional reports. Next: finish local tests and upload all coordinated src/scripts/web/test/workflow changes together via authenticated git or a PR; do not deploy a partial set. Existing publication and UI files depend on new regional modules. Validate discovery remotely before full regional scan. Legacy script discover-public-routes.mjs is not the shared path.

Base: origin/main 6c81151c0ee4a0181e12b9fa6adfb9262551be18. Fresh checkout; do not reuse the older divergent cloud-checkout.

## Current status

Changes in this checkout are NOT uploaded/committed to remote. Production public-data has not changed. Existing main CI run 34486392913 succeeded. Local original 26 tests passed; new navigation/publication tests passed (31), then regional priority test passed independently. Run complete npm test before upload.

Actual local headless guest navigation failed at page.goto waitUntil:commit timeout=30000. Repeated with bounded retry: both attempts timed out before departureBtn. No destination list or worldwide snapshot was obtained. This is not proof of an airline block; HTTP status was not returned. Do not assert discovery/full collection succeeded. Do not publish partial or fabricated results.

## Latest user preference

Collection order: Europe -> Americas -> Oceania -> Asia. prioritizeRoutes() orders discovered routes in stable regional batches. Existing month checkpoint/resume remains sequential. Dynamic selector region labels remain unchanged (e.g. Europe/Middle East, Oceania, Japan, Southeast Asia/Guam). Unknown regions currently fall into the final Asia group; review if airline adds Africa as a separate region.

## Changes prepared

- Shared public-navigation: commit + visible departureBtn, at most two attempts, 10-second backoff, immediate 403/429 stop. Collector exits 75 on access limits; workflow stops process recovery on 75.
- Discovery-only flag emits region/code lists without writing production results. Domestic airports rejected; structural discovery sanity gate; production collector uses same discovery. Dedicated manual read-only workflow discovery.yml (no publication/secrets/artifacts).
- Worldwide publication validator rejects smoke/partial scopes, failed/incomplete scans, missing/duplicate month coverage, wrong route/source/class/cabin observations. Empty O/A result can be legitimate if every request was validated and covered. Last production snapshot untouched on rejection.
- CLOSED changes require normal coverage for the seat month/date, not UNQUERYABLE or a date rolling outside range.
- Resume drops obsolete routes; collection groups follow user order.
- Alert set filters normalized in stable sorted order; calendar dates validated rather than regex only.
- Manual force scan bypasses failed timestamp precheck; health notices publication failure/cancellation.

## Publication blocker

GitHub connector is unavailable in current tools. Public git clone/read works; local noninteractive Git credential helper cannot authenticate for push. Edge is signed into correct GitHub owner and upload UI is open, but fileChooser.setFiles failed with Not allowed. Browser extension needs Allow access to file URLs enabled by user. Do not extract browser cookies/tokens or broaden authentication permissions. No files were uploaded.

## Next

1. After upload permission/auth is available, upload changed src/test/scripts/workflows preserving paths, or use authenticated git. Never force push. Validate entire diff and rerun npm test/syntax/cloud build first.
2. Run discovery.yml on GitHub; inspect visible departureBtn log, region count, exact airport codes. Fix selectors based on actual UI evidence. Old scripts/discover-public-routes.mjs remains legacy; use src/public-extract.mjs --discover-only for the shared path.
3. Only if discovery passes, smoke-test one month for a small route set in a separate output (scope SMOKE cannot publish), then full worldwide sequential scan.
4. Whole successful scan -> publication/build -> verify snapshot. If blocked keep old 92-combination/26-route snapshot and degraded health.
5. Review remaining alerts unknown-coverage state handling, notification idempotency and timeout, cloud export stale snapshot, health recovery semantics, adapter refactor, mobile UX. These were NOT fixed this turn.
6. Verify Render service srv-dah8gkdbedkc739jdlbg manual/auto deployment and exact deployed SHA; live site https://mileway-award-monitor.onrender.com/. No deployment or live UI QA of these changes yet. Never claim complete from GitHub commit alone.
7. Public health currently reports no configured rule/Telegram/email secrets. Real notifications not activated or tested. Secrets registration requires user-supplied channel credentials; never publish credentials.
