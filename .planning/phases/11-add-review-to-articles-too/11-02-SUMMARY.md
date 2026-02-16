---
phase: 11-add-review-to-articles-too
plan: 02
subsystem: ui
tags: [sidebar, badges, review, admin, drizzle, sql]

# Dependency graph
requires:
  - phase: 11-add-review-to-articles-too
    provides: "getReviewCountsByArticle batch query (plan 01)"
provides:
  - "Sidebar review count badges for admin users"
  - "reviewCounts prop threading from layout through sidebar components"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-to-client Map serialization via Object.fromEntries to Record<string, number>"
    - "Conditional data fetching based on user role in layout (admin-only queries)"

key-files:
  created: []
  modified:
    - src/app/(wiki)/layout.tsx
    - src/components/wiki/app-sidebar.tsx
    - src/components/wiki/sortable-sidebar.tsx
    - src/components/wiki/sortable-item.tsx

key-decisions:
  - "Convert Map to Record<string, number> via Object.fromEntries for Next.js server-to-client serialization"
  - "Badge uses bg-muted text-muted-foreground for subtle appearance matching both light and dark modes"
  - "Removed ml-auto from context menu div since flex-1 on article name pushes items right naturally"

patterns-established:
  - "Role-gated data fetching: admin-only queries run in Promise.all with category tree"
  - "Prop threading pattern: layout -> AppSidebar -> SortableSidebar/CategoryTree -> SortableItem"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 11 Plan 02: Sidebar Review Badges Summary

**Subtle review count badges on sidebar articles for admin users via batch query with muted circular styling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T19:31:17Z
- **Completed:** 2026-02-16T19:35:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Admin users see subtle count badges on sidebar articles with pending review items
- Badges show accurate counts: (needsReview ? 1 : 0) + active annotation count
- Non-admin users see no badges (empty reviewCounts from layout)
- Single batch SQL query fetches all review counts efficiently (no N+1)
- Badge styling is subtle: small muted circle (size-5, bg-muted, text-[10px]) not bright alerts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add batch review count query and wire through wiki layout to AppSidebar** - `18d1133` (feat)
2. **Task 2: Add review count badges to SortableSidebar, SortableItem, and CategoryTree** - `43cac56` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/app/(wiki)/layout.tsx` - Parallel fetch of review counts for admin, convert Map to Record, pass as prop
- `src/components/wiki/app-sidebar.tsx` - Thread reviewCounts prop to SortableSidebar and CategoryTree
- `src/components/wiki/sortable-sidebar.tsx` - Accept reviewCounts, pass per-article reviewCount to SortableItem
- `src/components/wiki/sortable-item.tsx` - Render subtle badge when reviewCount > 0, fix context menu alignment

## Decisions Made
- Convert Map to Record<string, number> via Object.fromEntries for Next.js server-to-client serialization (Map is not serializable across the boundary)
- Badge uses bg-muted and text-muted-foreground for subtle appearance that works in both light and dark modes
- Removed ml-auto from context menu div in SortableItem since the flex-1 on the article name already pushes badge and context menu to the right

## Deviations from Plan

### Notes on Pre-existing Work

Plan 11-01 already implemented the `getReviewCountsByArticle` batch query in queries.ts and the CategoryTree reviewCounts prop threading. Task 1's query addition and Task 2's CategoryTree changes were already present. The remaining work was wiring layout.tsx, AppSidebar, SortableSidebar, and SortableItem.

No auto-fix deviations were needed.

**Total deviations:** 0
**Impact on plan:** Some work was pre-completed by plan 11-01 (queries.ts function, category-tree.tsx changes). Remaining work executed as specified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 is complete: both the article-level Review Queue tab (plan 01) and sidebar badges (plan 02) are implemented
- All review-related features are admin-only and data-driven

## Self-Check: PASSED

- All 6 key files verified on disk
- Commit 18d1133 (Task 1) verified in git log
- Commit 43cac56 (Task 2) verified in git log
- TypeScript compilation: 0 errors
- Next.js build: success

---
*Phase: 11-add-review-to-articles-too*
*Completed: 2026-02-16*
