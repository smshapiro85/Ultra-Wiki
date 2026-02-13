---
phase: 02-admin-settings-and-github-sync
plan: 02
subsystem: github, sync, admin
tags: [octokit, github-api, file-tree, sha-comparison, concurrency-lock, shadcn-checkbox, scroll-area, drizzle]

# Dependency graph
requires:
  - phase: 02-admin-settings-and-github-sync
    plan: 01
    provides: "Settings library (getSetting, setSetting), SETTING_KEYS constants, admin nav with Sync link"
  - phase: 01-foundation-and-authentication
    provides: "DB schema (githubFiles, excludedPaths, syncLogs tables), getDb pattern, auth/requireAdmin"
provides:
  - "GitHub client factory (getOctokit) reading API key from site_settings"
  - "Repository URL parser (parseRepoUrl) supporting multiple GitHub URL formats"
  - "Tree fetching (fetchRepoTree) retrieving full recursive repo structure via Octokit"
  - "Path inclusion logic (isPathIncluded) with exact, child, and ancestor matching"
  - "Tree builder (buildTreeStructure) converting flat files to nested TreeNode hierarchy"
  - "Sync engine (runSync) with atomic concurrency lock, SHA change detection, and retry logic"
  - "Interactive file tree UI at /admin/sync with checkboxes and persist-to-DB"
  - "Manual sync trigger with progress display and sync history table"
  - "POST /api/admin/sync for programmatic sync access"
affects: [02-03-cron-sync-schedule, 03-ai-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Atomic sync lock via INSERT NOT EXISTS on sync_logs", "SHA-based change detection against github_files", "Recursive file tree component with inclusion checkboxes", "Server action pattern for file tree save and manual sync"]

key-files:
  created:
    - src/lib/github/client.ts
    - src/lib/github/tree.ts
    - src/lib/github/sync.ts
    - src/app/(admin)/admin/sync/page.tsx
    - src/app/(admin)/admin/sync/actions.ts
    - src/app/(admin)/admin/sync/file-tree.tsx
    - src/app/(admin)/admin/sync/sync-trigger.tsx
    - src/app/api/admin/sync/route.ts
    - src/components/ui/checkbox.tsx
    - src/components/ui/scroll-area.tsx
  modified: []

key-decisions:
  - "excludedPaths table repurposed as included-paths storage -- pattern column stores paths to INCLUDE, everything else excluded"
  - "File content not fetched during sync -- only metadata (path, SHA) stored in github_files, content deferred to Phase 3"
  - "Retry logic: 3 retries with [1s, 4s, 16s] delays for transient errors only; 401/404 fail immediately"
  - "File tree uses Save Inclusions button (not auto-save) to avoid spamming server on rapid checkbox clicks"

patterns-established:
  - "GitHub client pattern: getOctokit() factory always creates fresh instance to pick up key changes"
  - "Sync lock: atomic INSERT NOT EXISTS on sync_logs for Neon HTTP compatibility (no advisory locks)"
  - "Inclusion model: all excluded by default, admin explicitly includes paths via checkboxes"
  - "Change detection: compare remote SHA against stored github_files.fileSha to detect add/modify/remove"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 02 Plan 02: GitHub Sync Engine & Dashboard Summary

**Octokit-based GitHub tree fetching with SHA change detection, atomic sync lock, interactive file tree UI with inclusion checkboxes, and manual sync trigger at /admin/sync**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T19:24:00Z
- **Completed:** 2026-02-13T19:28:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- GitHub client library: Octokit factory, repo URL parser (multiple formats), repo config reader from settings
- Tree fetching with full recursive retrieval, path inclusion logic (exact/child/ancestor), and nested tree builder
- Sync engine: atomic concurrency lock via NOT EXISTS INSERT, SHA-based change detection, metadata-only apply, retry for transient errors
- Sync dashboard at /admin/sync with two-column layout: file tree (left) and sync controls + history (right)
- Interactive file tree with recursive nodes, checkboxes, directory collapse/expand, indeterminate state
- Manual sync trigger with loading state, polling, and result display (success stats or error)
- Sync history table showing last 10 operations with status badges, trigger type, file counts, timestamps

## Task Commits

Each task was committed atomically:

1. **Task 1: GitHub client, tree fetching, sync engine with concurrency lock** - `f6c20b2` (feat)
2. **Task 2: Sync dashboard with file tree UI and manual sync trigger** - `c3fb4a1` (feat)

## Files Created/Modified
- `src/lib/github/client.ts` - Octokit factory, parseRepoUrl, getRepoConfig
- `src/lib/github/tree.ts` - fetchRepoTree, isPathIncluded, buildTreeStructure, TreeFile/TreeNode types
- `src/lib/github/sync.ts` - acquireSyncLock, releaseSyncLock, detectChanges, applyChanges, runSync with retry
- `src/app/(admin)/admin/sync/page.tsx` - Sync dashboard server component with file tree and sync controls
- `src/app/(admin)/admin/sync/actions.ts` - Server actions: loadFileTree, saveIncludedPaths, triggerManualSync, getSyncStatus, getRecentSyncLogs
- `src/app/(admin)/admin/sync/file-tree.tsx` - Interactive recursive file tree with checkboxes and inclusion logic
- `src/app/(admin)/admin/sync/sync-trigger.tsx` - Manual sync button with loading/polling/result states
- `src/app/api/admin/sync/route.ts` - POST endpoint for programmatic sync access
- `src/components/ui/checkbox.tsx` - shadcn Checkbox component
- `src/components/ui/scroll-area.tsx` - shadcn ScrollArea component

## Decisions Made
- Repurposed excludedPaths table as included-paths storage: the `pattern` column now stores paths that are INCLUDED, inverting the original exclusion model to match the "all excluded by default" requirement
- File content not fetched during sync -- only path and SHA metadata stored in github_files. Content fetching deferred to Phase 3 AI pipeline to keep sync fast
- Retry logic uses exponential backoff at [1s, 4s, 16s] for transient errors (network, rate limit, 5xx). Auth errors (401) and not-found (404) fail immediately without retry
- File tree uses explicit "Save Inclusions" button rather than auto-save/debounce to give admin control over when changes persist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Build cache (ENOTEMPTY on .next/server) required clearing before rebuild -- same issue documented in 02-01-SUMMARY, resolved by removing .next directory

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GitHub sync engine ready for Plan 02-03 (cron-triggered scheduled sync)
- runSync() accepts "manual" or "scheduled" trigger type, ready for cron endpoint integration
- File tree and inclusion rules fully functional for admin workflow
- github_files table populated with file metadata on sync, ready for Phase 3 AI pipeline to fetch content

## Self-Check: PASSED

All 10 created files verified present. Both task commits (f6c20b2, c3fb4a1) verified in git log.

---
*Phase: 02-admin-settings-and-github-sync*
*Completed: 2026-02-13*
