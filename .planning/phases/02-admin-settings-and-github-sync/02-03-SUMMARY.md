---
phase: 02-admin-settings-and-github-sync
plan: 03
subsystem: sync, admin, api
tags: [cron-parser, cron-endpoint, bearer-auth, sync-history, shadcn-table, shadcn-badge, schedule-checking]

# Dependency graph
requires:
  - phase: 02-admin-settings-and-github-sync
    plan: 01
    provides: "Settings library (getSetting), SETTING_KEYS (sync_cron_schedule), cron-parser v5"
  - phase: 02-admin-settings-and-github-sync
    plan: 02
    provides: "runSync engine, sync dashboard, getRecentSyncLogs, syncLogs table, file tree UI"
provides:
  - "Cron-triggered sync endpoint at POST /api/admin/sync/cron with Bearer CRON_SECRET auth"
  - "Schedule checker (isSyncDue) using cron-parser to compare last completed sync against cron schedule"
  - "Enhanced sync history table with status badges, trigger type, duration, file counts, and error display"
  - "Active sync status banner with pulsing indicator"
  - "SyncTrigger lockout when sync is already running"
affects: [03-ai-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Bearer token machine-to-machine auth for cron endpoint", "cron-parser v5 CronExpressionParser.parse() for schedule comparison", "Pulsing status indicator with Tailwind animate-ping"]

key-files:
  created:
    - src/lib/github/schedule.ts
    - src/app/api/admin/sync/cron/route.ts
    - src/app/(admin)/admin/sync/sync-history.tsx
  modified:
    - src/app/(admin)/admin/sync/page.tsx
    - src/app/(admin)/admin/sync/actions.ts
    - src/app/(admin)/admin/sync/sync-trigger.tsx
    - .env.example
    - docker-compose.yml

key-decisions:
  - "Cron endpoint uses Bearer token auth (CRON_SECRET env var) instead of session auth -- machine-to-machine communication"
  - "Schedule checking compares cron-parser prev() against last completed sync's completedAt -- no next() tracking needed"
  - "Invalid cron expression treated as 'not configured' rather than error -- graceful degradation"

patterns-established:
  - "Machine-to-machine auth: Bearer token from env var for service endpoints"
  - "Schedule-based execution: external cron fires at fixed interval, route checks internal schedule before acting"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 02 Plan 03: Cron Sync & History Dashboard Summary

**Cron-triggered sync endpoint with Bearer auth and schedule checking via cron-parser, plus enhanced sync history table with status badges and active sync banner**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T19:31:27Z
- **Completed:** 2026-02-13T19:34:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Cron-triggered sync endpoint at POST /api/admin/sync/cron: validates Bearer CRON_SECRET, checks schedule via isSyncDue(), runs sync only when due
- Schedule checker using cron-parser v5: reads admin-configured cron expression, compares previous tick against last completed sync timestamp
- Enhanced sync history table (SyncHistory component) with status badges (green/red/pulsing-blue), trigger type badges (manual/scheduled), duration, file counts, truncated error messages with tooltip
- Active sync status banner with pulsing dot indicator, start time display, and SyncTrigger disabled prop for lockout
- Improved sync page layout: status banner (top), two-column grid with wider file tree, full-width history table (bottom)
- CRON_SECRET documented in .env.example, cron setup documented as comments in docker-compose.yml

## Task Commits

Each task was committed atomically:

1. **Task 1: Cron API route and schedule checking logic** - `dc59c38` (feat)
2. **Task 2: Enhanced sync history dashboard** - `432d6f3` (feat)

## Files Created/Modified
- `src/lib/github/schedule.ts` - isSyncDue() using cron-parser v5 to check admin-configured schedule
- `src/app/api/admin/sync/cron/route.ts` - POST cron endpoint with Bearer CRON_SECRET auth
- `src/app/(admin)/admin/sync/sync-history.tsx` - SyncHistory client component with Table, status/trigger badges, duration formatting
- `src/app/(admin)/admin/sync/page.tsx` - Updated layout with status banner, two-column grid, full-width history
- `src/app/(admin)/admin/sync/actions.ts` - Added getActiveSyncStatus(), enriched getRecentSyncLogs() with duration and limit 20
- `src/app/(admin)/admin/sync/sync-trigger.tsx` - Added disabled prop for active-sync lockout
- `.env.example` - Added CRON_SECRET documentation
- `docker-compose.yml` - Added cron setup documentation comments

## Decisions Made
- Bearer token auth for cron endpoint: CRON_SECRET env var compared against Authorization header. No session auth since this is machine-to-machine (external cron -> API).
- Schedule checking strategy: use cron-parser's prev() from current time, compare against last completed sync's completedAt. If prev() is after last sync, a scheduled tick was missed, so sync is due.
- Invalid cron expressions treated as "not configured" (log warning, return false) rather than throwing errors. This prevents a bad setting from blocking all scheduled syncs permanently.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Build cache (ENOTEMPTY on .next/standalone) required partial cleanup before rebuild -- same known issue from prior plans, resolved by removing cache/server/static subdirectories.

## User Setup Required

External cron job required for scheduled sync:
- Set `CRON_SECRET` environment variable (generate with `openssl rand -base64 32`)
- Configure host cron or platform scheduler to POST to `/api/admin/sync/cron` with Bearer token
- Example: `*/5 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/admin/sync/cron`

## Next Phase Readiness
- Full Phase 2 sync lifecycle complete: settings configurable, file tree browsable, manual sync works, scheduled sync automated
- github_files table populated with file metadata (path, SHA) on each sync, ready for Phase 3 AI pipeline to fetch content
- Sync history provides admin visibility into all sync operations for debugging and monitoring
- No blockers for Phase 3

---
*Phase: 02-admin-settings-and-github-sync*
*Completed: 2026-02-13*
