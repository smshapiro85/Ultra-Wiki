---
phase: 11-add-review-to-articles-too
plan: 01
subsystem: ui
tags: [tabs, review-queue, annotations, comments, shadcn-ui, drizzle]

# Dependency graph
requires:
  - phase: 05-ai-review-annotations
    provides: "AI review annotation API endpoints and AnnotationBanner component"
  - phase: 07-comments
    provides: "Comments table and CommentsSection component"
provides:
  - "ArticleReviewQueue component for in-article review tab"
  - "getArticleCommentCount query for comment count in tab labels"
  - "getReviewCountsByArticle batch query for sidebar badges"
  - "5-tab ArticleTabs with conditional Review Queue tab and count labels"
affects: [11-02-sidebar-badges]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional tab rendering via optional ReactNode prop (undefined = tab hidden)"
    - "Server-side count fetching to avoid tab label flash"

key-files:
  created:
    - "src/components/wiki/article-review-queue.tsx"
  modified:
    - "src/lib/wiki/queries.ts"
    - "src/components/wiki/article-tabs.tsx"
    - "src/app/(wiki)/wiki/[articleSlug]/page.tsx"
    - "src/components/wiki/category-tree.tsx"

key-decisions:
  - "Review count = (needsReview ? 1 : 0) + annotationCount for consistent counting"
  - "ArticleReviewQueue is a simpler article-scoped view without admin search/filter/sort controls"
  - "Comment count and review count fetched server-side to avoid layout flash"
  - "Non-admin users get undefined for reviewQueueContent so the tab never renders"

patterns-established:
  - "Optional tab pattern: pass ReactNode as undefined to conditionally hide a tab"
  - "Count-in-tab-label pattern: show count in parentheses only when > 0"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 11 Plan 01: Article Review Queue Tab and Comment Counts Summary

**Article-scoped Review Queue tab with annotation dismiss and comment/review counts in tab labels using server-side count fetching**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T19:31:15Z
- **Completed:** 2026-02-16T19:35:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Admin users see a 5th "Review Queue" tab between Comments and History showing merge conflicts and AI annotations with dismiss capability
- Comments tab shows count in parentheses for all users when comments exist
- Review Queue tab shows count in parentheses for admins when review items exist
- Non-admin users see exactly 4 tabs with no trace of review queue functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getArticleCommentCount query and create ArticleReviewQueue component** - `eb29b5f` (feat)
2. **Task 2: Update ArticleTabs for 5th tab and counts, wire into article page** - `1ec8e4c` (feat)

## Files Created/Modified
- `src/components/wiki/article-review-queue.tsx` - New client component for article-scoped review queue tab content
- `src/lib/wiki/queries.ts` - Added getArticleCommentCount() and getReviewCountsByArticle() queries
- `src/components/wiki/article-tabs.tsx` - Extended to 5-tab system with conditional Review Queue and count labels
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Wired comment count, review count, and review queue content into tabs
- `src/components/wiki/category-tree.tsx` - Added reviewCounts prop to CategoryTreeProps interface

## Decisions Made
- Review count formula: `(needsReview ? 1 : 0) + annotationCount` -- gives admins a total count of actionable items
- ArticleReviewQueue is intentionally simpler than admin ReviewQueueList -- no search/filter/sort since it's single-article context
- Counts fetched server-side in Promise.all to avoid tab label layout flash
- Non-admin users receive `undefined` for `reviewQueueContent`, causing ArticleTabs to skip rendering the tab entirely

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added reviewCounts prop to CategoryTreeProps and SortableSidebarProps**
- **Found during:** Task 2
- **Issue:** Pre-existing changes in app-sidebar.tsx passed `reviewCounts` prop to SortableSidebar and CategoryTree, but neither component's type interface accepted it, causing TypeScript errors that blocked the build
- **Fix:** Added `reviewCounts?: Record<string, number>` to CategoryTreeProps (linter auto-applied it to SortableSidebarProps)
- **Files modified:** src/components/wiki/category-tree.tsx, src/components/wiki/sortable-sidebar.tsx
- **Verification:** `npx tsc --noEmit` passes, `npm run build` succeeds
- **Committed in:** 1ec8e4c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock build. No scope creep -- these prop types will be used by Plan 02 sidebar badges.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review Queue tab functional for admins on all article pages
- Plan 02 (sidebar review badges) can proceed -- getReviewCountsByArticle() query and reviewCounts prop types are already in place
- Build passes cleanly with no type errors

## Self-Check: PASSED

- All 5 key files verified on disk
- Both task commits (eb29b5f, 1ec8e4c) verified in git log
- `npx tsc --noEmit` passes cleanly
- `npm run build` succeeds

---
*Phase: 11-add-review-to-articles-too*
*Completed: 2026-02-16*
