---
phase: 03-ai-processing-pipeline
plan: 04
subsystem: ai
tags: [blocknote, dynamic-import, turbopack, rsc, jsdom]

# Dependency graph
requires:
  - phase: 03-ai-processing-pipeline (plan 03)
    provides: "AI pipeline orchestrator wired into sync flow"
provides:
  - "pipeline.ts with zero static imports of @blocknote/server-util -- no createContext crash"
  - "Dynamic import() pattern at all 4 markdown conversion call sites"
affects: [04-article-editor, 05-technical-view-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Dynamic import() for @blocknote/server-util-dependent modules in RSC/Turbopack contexts"]

key-files:
  created: []
  modified: ["src/lib/ai/pipeline.ts"]

key-decisions:
  - "Dynamic import at each call site (not hoisted to function top) -- keeps lazy loading as granular as possible"

patterns-established:
  - "Dynamic import pattern: any module transitively importing @blocknote/server-util must be dynamically imported to avoid createContext crash in RSC/Turbopack"

# Metrics
duration: 1min
completed: 2026-02-14
---

# Phase 3 Plan 4: Gap Closure -- Dynamic Markdown Import Fix Summary

**Replaced static @blocknote/server-util import in pipeline.ts with 4 dynamic import() call sites to fix createContext crash in RSC/Turbopack**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-14T00:21:59Z
- **Completed:** 2026-02-14T00:22:54Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed the static `import { blocksToMarkdown, markdownToBlocks } from "@/lib/content/markdown"` that pulled @blocknote/server-util into the module graph at evaluation time
- Added dynamic `import()` at all 4 call sites: processCreateArticle (markdownToBlocks), processUpdateArticle AI-only branch (markdownToBlocks), processUpdateArticle human-edited branch (blocksToMarkdown), processUpdateArticle merge resolution (markdownToBlocks)
- TypeScript compiles cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace static markdown.ts import with dynamic imports in pipeline.ts** - `118e068` (fix)

## Files Created/Modified
- `src/lib/ai/pipeline.ts` - Removed static import of blocksToMarkdown/markdownToBlocks, replaced with 4 dynamic import() calls at each usage site

## Decisions Made
- Dynamic import at each call site rather than hoisting to function top -- keeps lazy loading granular and mirrors the pattern sync.ts uses for pipeline.ts itself

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 gap closure complete -- AI pipeline no longer crashes on createContext
- Ready for Phase 4 (Article Editor) which will use BlockNote for rich text editing

## Self-Check: PASSED

- FOUND: src/lib/ai/pipeline.ts
- FOUND: 03-04-SUMMARY.md
- FOUND: 118e068 (task 1 commit)

---
*Phase: 03-ai-processing-pipeline*
*Completed: 2026-02-14*
