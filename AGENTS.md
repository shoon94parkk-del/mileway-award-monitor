# Mileway agent rules

Mileway is an iteratively hardened public award-seat explorer. Repository memory is authoritative; do not rely on chat memory alone.

## Read before editing
1. `docs/project-memory.md`
2. `docs/regression-guardrails.md`
3. `docs/decision-log.md`
4. `README.md`
5. Tests for collection/source/alerts/mobile behavior

## Required workflow
1. Search previous code/tests/decisions for the same behavior.
2. Preserve the intentionally reduced monitored scope unless explicitly changed.
3. Never turn "collector success" into "source freshness"; they are separate states.
4. Never convert `UNQUERYABLE`, failed collection, or stale source into "no seats".
5. Add/update regression coverage for behavioral changes.
6. Run `npm test` and cloud build checks.
7. Verify actual Render commit/service after operational changes.
8. Update `docs/decision-log.md` and memory/guardrails when behavior changes.

## Current production
- Static site: https://mileway-hoon.onrender.com
- Alert API: https://mileway-alert-api-hoon.onrender.com
- Workspace: Hoon_Lap
- Repository: `shoon94parkk-del/mileway-award-monitor`

## Never regress
- Public daily source only; do not claim realtime inventory.
- No airline-login/CAPTCHA/authentication circumvention.
- Keep source freshness separate from job/collector success.
- Keep valid `OPENED` and `CLOSED` history.
- Preserve canonical alert region IDs and current route scope.
- Prevent duplicate collectors and duplicate 23:05 recovery dispatch.
- Do not replace a last-good region with incomplete/failed data.
- Mobile navigation stays one row; Home resets search/filter state without deleting saved data.
- User alert secrets/rules never enter public repository data.
