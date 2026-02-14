---
phase: 04-wiki-viewer
plan: 03
subsystem: ui
tags: [full-text-search, debounce, tsvector, bookmarks, dashboard, search-input, use-debounce, shadcn-card, lucide-react]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Database schema (users, articles, categories tables), auth"
  - phase: 04-wiki-viewer/04-01
    provides: "Wiki layout with SidebarProvider, data access layer (searchArticles, getRecentArticles, getCategoryTreeWithArticles)"
provides:
  - "Full-text search page at /search with debounced input and tsvector-powered results"
  - "SearchInput client component with 300ms debounce updating URL params"
  - "SearchResults component with sanitized highlighted snippets (mark tag preservation)"
  - "HomeDashboard with recent updates (change source badges) and user bookmarks"
  - "user_bookmarks junction table with composite PK"
  - "getUserBookmarks and isArticleBookmarked query functions"
  - "toggleBookmark server action with auth check and revalidation"
  - "Global search input in wiki header bar"
affects: [05-editor, 06-comments, 07-ask-ai-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [debounced-url-param-search, junction-table-bookmarks, sanitized-dangerouslySetInnerHTML, change-source-badge-mapping]

key-files:
  created:
    - src/components/wiki/search-input.tsx
    - src/components/wiki/search-results.tsx
    - src/app/(wiki)/search/page.tsx
    - src/components/wiki/home-dashboard.tsx
    - src/lib/wiki/actions.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/wiki/queries.ts
    - src/app/(wiki)/page.tsx
    - src/app/(wiki)/layout.tsx

key-decisions:
  - "SearchInput uses useDebouncedCallback with URL param navigation (not state-based filtering)"
  - "Headline sanitization: strip all HTML except <mark> tags via regex for XSS prevention"
  - "user_bookmarks uses composite PK (userId, articleId) with no separate id column"
  - "actions.ts created fresh (Plan 02 not yet executed) with forward-looking imports for regenerateArticle"

patterns-established:
  - "Debounced search pattern: client input -> URL params -> server fetch -> server component render"
  - "Junction table bookmark pattern: composite PK, toggle via exists-check then INSERT/DELETE"
  - "Change source badge mapping: switch on changeSource enum -> colored Badge with lucide icon"
  - "Global header search: SearchInput in layout header wrapped in Suspense for useSearchParams"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 4 Plan 03: Home Dashboard & Search Summary

**Full-text search with debounced as-you-type results via tsvector, home dashboard with recent updates and bookmarks, user_bookmarks schema, and global header search input**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T01:31:18Z
- **Completed:** 2026-02-14T01:35:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added user_bookmarks junction table with composite PK and migration
- Created bookmark query functions (getUserBookmarks, isArticleBookmarked) and toggleBookmark server action
- Built SearchInput client component with 300ms debounced navigation to /search?q=term
- Built SearchResults component with XSS-safe highlighted snippets using mark tag preservation
- Created search page at /search with URL param-driven full-text search
- Created HomeDashboard with two-column layout showing recent updates (with change source badges) and user bookmarks
- Updated home page to fetch recent articles and bookmarks in parallel
- Added global SearchInput in wiki layout header for search access from any page

## Task Commits

Each task was committed atomically:

1. **Task 1: Add user_bookmarks table, migration, and bookmark queries/actions** - `23a9601` (feat)
2. **Task 2: Search page, search input, and home dashboard** - `51878bc` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - Added userBookmarks junction table with composite PK
- `src/lib/wiki/queries.ts` - Added getUserBookmarks and isArticleBookmarked functions
- `src/lib/wiki/actions.ts` - Created with toggleBookmark server action (auth check, revalidation)
- `src/components/wiki/search-input.tsx` - Client component with debounced URL param search
- `src/components/wiki/search-results.tsx` - Server component with sanitized highlighted snippets
- `src/app/(wiki)/search/page.tsx` - Search page reading query from URL params
- `src/components/wiki/home-dashboard.tsx` - Dashboard with recent updates and bookmarks
- `src/app/(wiki)/page.tsx` - Updated home page with parallel data fetching and dashboard
- `src/app/(wiki)/layout.tsx` - Added SearchInput to global header bar

## Decisions Made
- SearchInput navigates via URL params (router.push) rather than lifting state, enabling server-side search and shareable URLs
- Headline sanitization strips all HTML tags except `<mark>` via regex to prevent XSS while preserving search highlighting
- user_bookmarks uses composite PK (userId, articleId) with no separate id column -- simple and efficient for junction table
- Created actions.ts fresh since Plan 02 hasn't executed yet; imports are forward-looking for Plan 02's regenerateArticle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 viewer features (sidebar, article page, search, dashboard) now complete
- Search uses Postgres tsvector full-text search with ts_rank and ts_headline
- Bookmark toggle provides foundation for personalized wiki experience
- Ready for Phase 5 (editor) which will need the article viewer infrastructure

## Self-Check: PASSED

All 9 created/modified files verified on disk. Both task commits (23a9601, 51878bc) verified in git log. `npm run build` passed successfully.

---
*Phase: 04-wiki-viewer*
*Completed: 2026-02-14*
