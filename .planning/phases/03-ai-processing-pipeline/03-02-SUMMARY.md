---
phase: 03-ai-processing-pipeline
plan: 02
subsystem: merge
tags: [node-diff3, diff, blocknote, three-way-merge, conflict-resolution, drizzle]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Database schema (articles, articleVersions tables with changeSource enum)"
  - phase: 01-foundation
    provides: "Auth system (NextAuth with session/role for API route protection)"
provides:
  - "Three-way merge engine (mergeArticleContent) using node-diff3"
  - "Unified diff generation (generateUnifiedDiff) for version history"
  - "Conflict resolution logic (resolveConflict) with human-first strategy"
  - "BlockNote JSON <-> Markdown conversion (blocksToMarkdown, markdownToBlocks)"
  - "Article version tracking (createArticleVersion, getLastAIVersion)"
  - "POST /api/articles/[id]/dismiss-review endpoint"
affects: [03-ai-processing-pipeline, 05-technical-view-comments]

# Tech tracking
tech-stack:
  added: [node-diff3, diff, "@blocknote/server-util", "@types/diff"]
  patterns: [three-way-merge-on-markdown, human-first-conflict-resolution, lazy-singleton-editor]

key-files:
  created:
    - src/lib/merge/three-way.ts
    - src/lib/merge/diff.ts
    - src/lib/merge/conflict.ts
    - src/lib/content/markdown.ts
    - src/lib/content/version.ts
    - src/app/api/articles/[id]/dismiss-review/route.ts
  modified: []

key-decisions:
  - "Conflict markers never stored in article content -- human version kept on conflict, AI proposal stored in version history"
  - "node-diff3 merge() conflict counting via startsWith('<<<<<<<') marker detection"
  - "ServerBlockNoteEditor as lazy singleton (synchronous create, reused across requests)"

patterns-established:
  - "Human-first conflict resolution: on merge conflict, keep human edits as article content, store AI proposal with change_source ai_merged in version history, set needs_review flag"
  - "Lazy singleton pattern for ServerBlockNoteEditor (JSDOM-backed, created once per process)"
  - "Version tracking with createArticleVersion for all content changes (AI, human, merged)"

# Metrics
duration: 5min
completed: 2026-02-13
---

# Phase 3 Plan 2: Merge Engine Summary

**Three-way merge using node-diff3 with human-first conflict resolution, BlockNote conversion via @blocknote/server-util, version tracking, and dismiss-review API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T21:34:11Z
- **Completed:** 2026-02-13T21:39:31Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Three-way merge engine deterministically merges AI updates with human edits using node-diff3
- Conflict resolution preserves human edits and stores AI proposals in version history with needs_review flag
- BlockNote JSON <-> Markdown conversion at pipeline boundaries using official @blocknote/server-util
- Unified diff generation for version history display via the diff package
- Article version tracking (create versions, query last AI version as merge base)
- Dismiss-review API endpoint allows any authenticated user to clear the needs_review banner

## Task Commits

Each task was committed atomically:

1. **Task 1: Three-way merge, diff generation, and BlockNote conversion** - `b514595` (feat)
2. **Task 2: Conflict resolution, version tracking, and review banner dismissal** - `467ad77` (feat)

## Files Created/Modified
- `src/lib/merge/three-way.ts` - Three-way merge using node-diff3 with conflict detection and counting
- `src/lib/merge/diff.ts` - Unified diff generation using diff package for version history
- `src/lib/merge/conflict.ts` - Conflict resolution: keep human version on conflict, store AI proposal
- `src/lib/content/markdown.ts` - BlockNote JSON <-> Markdown conversion via ServerBlockNoteEditor
- `src/lib/content/version.ts` - createArticleVersion and getLastAIVersion helpers
- `src/app/api/articles/[id]/dismiss-review/route.ts` - POST endpoint to clear needs_review flag

## Decisions Made
- Conflict markers are never stored in article content -- on conflict, the human-edited version is kept as the article content and the AI's full proposed content is stored as a version record with change_source "ai_merged"
- node-diff3 merge() returns `<<<<<<<` markers without labels by default; conflict counting uses `startsWith("<<<<<<<")` for robustness
- ServerBlockNoteEditor is created as a lazy singleton (synchronous `create()`, JSDOM-backed) and reused across all conversion calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `src/lib/ai/schemas.ts` (from plan 03-01) appeared during individual file type-checking but does not affect these files. Full project type check (`npx tsc --noEmit`) passes with `skipLibCheck: true` as configured in tsconfig.json.
- Stale `.next` cache caused initial `npm run build` to fail with ENOTEMPTY; resolved by clearing `.next` directory. Build then succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Merge engine is ready for integration with the AI pipeline orchestrator (plan 03-03)
- All merge/conflict/version exports match the interfaces expected by the pipeline
- The dismiss-review endpoint is functional and follows the same auth pattern as existing API routes

## Self-Check: PASSED

- All 6 created files verified on disk
- Both task commits (b514595, 467ad77) verified in git log
- SUMMARY.md exists at expected path

---
*Phase: 03-ai-processing-pipeline*
*Completed: 2026-02-13*
