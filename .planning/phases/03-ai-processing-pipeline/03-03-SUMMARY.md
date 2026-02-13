---
phase: 03-ai-processing-pipeline
plan: 03
subsystem: ai
tags: [pipeline, orchestrator, merge-strategy, article-generation, sync-integration, blocknote]

# Dependency graph
requires:
  - phase: 03-ai-processing-pipeline
    provides: "AI analysis engine (analyzeChanges, fetchFileContents, generateArticle) from plan 03-01"
  - phase: 03-ai-processing-pipeline
    provides: "Three-way merge, conflict resolution, version tracking, BlockNote conversion from plan 03-02"
  - phase: 02-admin-settings-and-github-sync
    provides: "Sync engine (runSync, applyChanges), GitHub client, site_settings"
provides:
  - "Pipeline orchestrator (runAIPipeline) wiring analysis, merge, and article CRUD"
  - "Automatic AI pipeline trigger after every sync"
  - "Article creation with category resolution, file links, and DB table mappings"
  - "Article update with human-edit-aware merge strategy"
  - "Sync statistics enhanced with articlesCreated and articlesUpdated"
affects: [04-article-editor, 05-technical-view-comments, sync-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-import-for-build-safety, delete-and-reinsert-for-link-updates]

key-files:
  created:
    - src/lib/ai/pipeline.ts
  modified:
    - src/lib/github/sync.ts

key-decisions:
  - "Dynamic import for pipeline in sync.ts to avoid BlockNote/JSDOM createContext error at build-time page collection"
  - "Delete-and-reinsert pattern for article_file_links and article_db_tables (simpler than diffing)"
  - "AI pipeline failure does not abort sync -- errors logged and sync completes with partial results"

patterns-established:
  - "Dynamic import pattern: use await import() for modules that transitively pull in JSDOM/BlockNote to avoid build-time SSR errors"
  - "Article update merge strategy: AI-only articles overwritten directly, human-edited articles use three-way merge with conflict resolution"
  - "Category resolution: try slug match, then name match, then create new category only as last resort"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 3 Plan 3: Pipeline Orchestrator & Sync Integration Summary

**AI pipeline orchestrator wiring analysis, article CRUD with merge strategy, and automatic trigger from sync engine with article statistics**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T21:43:25Z
- **Completed:** 2026-02-13T21:46:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Pipeline orchestrator (`runAIPipeline`) orchestrates the full end-to-end flow: fetch content from GitHub, run AI analysis, create/update articles with proper merge handling, populate file links and DB table mappings, track versions, and update sync statistics
- Sync engine modified to trigger AI pipeline automatically after every sync, with the lock held throughout to prevent race conditions
- Article creation path resolves or creates categories, generates full content, converts to BlockNote JSON, creates initial version, and populates file links and DB table mappings
- Article update path checks `hasHumanEdits` flag: AI-only articles are overwritten directly, human-edited articles use three-way merge with conflict resolution
- Both manual and cron sync endpoints automatically return `articlesCreated` and `articlesUpdated` in their response stats

## Task Commits

Each task was committed atomically:

1. **Task 1: Pipeline orchestrator** - `c23e2b5` (feat)
2. **Task 2: Wire pipeline into sync flow** - `981d3fc` (feat)

## Files Created/Modified
- `src/lib/ai/pipeline.ts` - Pipeline orchestrator: runAIPipeline with article create/update, category resolution, file links, DB tables, slug uniqueness, error isolation
- `src/lib/github/sync.ts` - Modified sync engine: triggers AI pipeline after applyChanges, releaseSyncLock persists article counts, SyncResult includes article stats

## Decisions Made
- Used dynamic `await import()` for the pipeline module in sync.ts instead of a top-level import, because the transitive dependency chain (pipeline -> markdown -> @blocknote/server-util -> JSDOM) causes a `createContext is not a function` error during Next.js static page collection at build time
- Delete-and-reinsert pattern for article_file_links and article_db_tables during updates (simpler than computing diffs, and the unique constraints prevent duplicates)
- AI pipeline errors are caught and logged but do not abort the sync -- partial results are better than complete failure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dynamic import to avoid BlockNote build-time error**
- **Found during:** Task 2 (wiring pipeline into sync flow)
- **Issue:** Top-level `import { runAIPipeline } from "@/lib/ai/pipeline"` in sync.ts caused the entire module graph to be pulled in at build time, including `@blocknote/server-util` which uses JSDOM's `createContext`. This fails during Next.js static page collection with `TypeError: JG.createContext is not a function`.
- **Fix:** Changed to dynamic `await import("@/lib/ai/pipeline")` inside the conditional block where the pipeline is actually called, so BlockNote is only loaded at runtime when processing changed files.
- **Files modified:** src/lib/github/sync.ts
- **Verification:** `npm run build` succeeds after the change
- **Committed in:** 981d3fc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for build correctness. No scope creep.

## Issues Encountered
- Stale `.next` cache caused an ENOTEMPTY error on second `npm run build` -- resolved by clearing `.next` directory (same issue noted in 03-02 SUMMARY).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full AI processing pipeline is complete and integrated into the sync flow
- All 8 AIPL requirements (AIPL-01 through AIPL-08) are covered by the three plans in Phase 3
- Phase 3 is done -- ready for Phase 4 (Article Editor)
- The pipeline creates articles with contentJson (BlockNote JSON) ready for the editor
- Version tracking and merge strategy are in place for when human edits begin

## Self-Check: PASSED

- All 2 created/modified files verified on disk
- Both task commits (c23e2b5, 981d3fc) verified in git log
- SUMMARY.md exists at expected path

---
*Phase: 03-ai-processing-pipeline*
*Completed: 2026-02-13*
