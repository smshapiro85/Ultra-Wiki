---
phase: 05-article-editing
plan: 04
subsystem: ai, ui, api
tags: [ai-review, annotations, llm, structured-output, collapsible-banner, drizzle]

# Dependency graph
requires:
  - phase: 03-ai-pipeline
    provides: "AI client, merge/conflict resolution, pipeline orchestrator"
  - phase: 04-wiki-viewer
    provides: "Article page, table-of-contents slugify, article-content heading IDs"
provides:
  - "ai_review_annotations table with severity enum"
  - "LLM review pass generating annotations after clean merge"
  - "Annotation API routes (GET active, POST dismiss)"
  - "Collapsible AnnotationBanner UI component with section highlighting"
  - "getActiveAnnotationCount server-side query"
affects: [05-article-editing, 06-technical-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: ["LLM structured review output for post-merge semantic analysis", "CSS class injection via useEffect for dynamic heading highlights", "Server-side count + client-side detail fetch pattern to avoid loading flash"]

key-files:
  created:
    - src/lib/ai/review.ts
    - src/app/api/articles/[id]/annotations/route.ts
    - src/app/api/articles/[id]/annotations/[annotationId]/dismiss/route.ts
    - src/components/wiki/annotation-banner.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/merge/conflict.ts
    - src/lib/ai/pipeline.ts
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx
    - src/lib/wiki/queries.ts

key-decisions:
  - "Trigger review inside resolveConflict without versionId (simpler, articleId sufficient for querying)"
  - "Server-side annotation count passed as initialCount prop to avoid loading flash on banner"
  - "Inline CSS via style tag for annotation-highlight class (self-contained, no globals.css modification)"
  - "Dynamic import for review module in conflict.ts matching existing pipeline pattern"

patterns-established:
  - "Post-merge LLM review: fire after clean merge, catch failures silently"
  - "Annotation highlight: useEffect adds/removes CSS class on heading elements by slug ID"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 5 Plan 4: AI Review Annotations Summary

**LLM post-merge review generating section-level annotations with collapsible banner UI, dismiss functionality, and heading highlights**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T02:45:49Z
- **Completed:** 2026-02-14T02:49:21Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- ai_review_annotations table with severity enum (info/warning/error), article/version references, and dismiss tracking
- LLM review function using structured output to detect contradictions, stale info, and semantic inconsistencies after merge
- Collapsible annotation banner on article page with severity icons, clickable section links, relative timestamps, and dismiss
- Yellow left-border highlighting on referenced section headings via dynamic CSS class injection

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ai_review_annotations table, create LLM review function, and integrate into pipeline** - `140ae24` (feat)
2. **Task 2: Create annotation banner UI, API routes, and section highlighting** - `c37662b` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - Added annotationSeverityEnum and aiReviewAnnotations table
- `src/lib/ai/review.ts` - LLM review pass generating annotations with structured output
- `src/lib/merge/conflict.ts` - Added triggerReview param, calls review after clean merge
- `src/lib/ai/pipeline.ts` - Passes triggerReview: true for human-edited article merges
- `src/app/api/articles/[id]/annotations/route.ts` - GET endpoint for active annotations
- `src/app/api/articles/[id]/annotations/[annotationId]/dismiss/route.ts` - POST endpoint for dismissing annotations
- `src/components/wiki/annotation-banner.tsx` - Collapsible banner with annotation cards and section highlighting
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Integrated AnnotationBanner below review banner
- `src/lib/wiki/queries.ts` - Added getActiveAnnotationCount helper

## Decisions Made
- Trigger review inside resolveConflict without versionId -- simpler approach, articleId is sufficient for all annotation queries
- Server-side annotation count avoids loading flash -- AnnotationBanner renders header immediately with initialCount, fetches full details client-side
- Inline CSS via style tag for the annotation-highlight class -- self-contained in the component, no globals.css modification needed
- Dynamic import for review module in conflict.ts -- matches existing pipeline pattern, avoids pulling AI dependencies into module graph at evaluation time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build error in `src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx` (SSR dynamic import issue from another plan's WIP) - does not affect this plan's code. TypeScript type checking passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AI review annotations fully wired: schema, LLM review, pipeline integration, API routes, and UI
- Annotation banner appears automatically when annotations exist after merge
- Ready for Phase 5 completion or Phase 6 work

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (140ae24, c37662b) verified in git log.

---
*Phase: 05-article-editing*
*Completed: 2026-02-14*
