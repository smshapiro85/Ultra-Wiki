---
phase: 08-ai-prompt-refinement
plan: 02
subsystem: ui
tags: [css, typography, tailwind, blocknote, heading-hierarchy]

# Dependency graph
requires:
  - phase: 04-article-display
    provides: "Prose typography setup, article page layout with text-3xl title"
provides:
  - "Reduced prose heading sizes (H1 1.5em, H2 1.25em, H3 1.1em) subordinate to article title"
  - "Matching BlockNote editor heading sizes for consistent reader/editor experience"
affects: [08-ai-prompt-refinement]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Heading hierarchy: article title (text-3xl) > H1 (1.5em) > H2 (1.25em) > H3 (1.1em)"]

key-files:
  created: []
  modified:
    - src/app/globals.css

key-decisions:
  - "H1 reduced to 1.5em (from 2.25em) to be clearly subordinate to text-3xl article title (1.875rem)"
  - "H3 reduced to 1.1em to maintain proportional hierarchy below H2"
  - "Side menu heights recalculated from font-size * 1.75 line-height + 6px padding formula"

patterns-established:
  - "Visual hierarchy: article title (text-3xl ~30px) > H1 (1.5em ~24px) > H2 (1.25em ~20px) > H3 (1.1em ~17.6px)"

# Metrics
duration: 1min
completed: 2026-02-14
---

# Phase 8 Plan 2: Heading Size Hierarchy Summary

**Reduced prose H1/H2/H3 and BlockNote heading CSS sizes so article content headings are subordinate to the page title**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-14T21:26:49Z
- **Completed:** 2026-02-14T21:27:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Prose H1 reduced from 2.25em to 1.5em, establishing clear subordination to article title (text-3xl = 1.875rem)
- Prose H2 reduced from 1.5em to 1.25em, H3 from 1.25em to 1.1em for proportional hierarchy
- BlockNote editor heading sizes updated to match prose (reader/editor parity)
- Side menu heights recalculated for new heading sizes (48px, 41px, 37px)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reduce prose and BlockNote heading sizes for clear hierarchy** - `1bb4b1a` (feat)

## Files Created/Modified
- `src/app/globals.css` - Added explicit prose h1/h2/h3 font-size overrides, updated BlockNote heading sizes and side menu heights

## Decisions Made
- H1 at 1.5em (~24px) is clearly smaller than article title at text-3xl (1.875rem = ~30px), a 20% reduction
- Maintained proportional spacing between heading levels (1.5em > 1.25em > 1.1em)
- Side menu heights derived from formula: font-size * 16px * 1.75 line-height + 6px padding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Heading hierarchy CSS is in place; when AI prompt changes (08-01) start using H1 as top-level section headings, they will display at the correct subordinate size
- Ready for remaining 08 plans (category strategy, article formatting prompts)

---
*Phase: 08-ai-prompt-refinement*
*Completed: 2026-02-14*

## Self-Check: PASSED
