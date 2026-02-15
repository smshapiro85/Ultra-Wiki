---
phase: 10-navigation-and-article-creation
plan: 01
subsystem: api
tags: [server-actions, drizzle, dnd-kit, shadcn, category-crud, article-crud]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Database schema with categories and articles tables"
provides:
  - "Category CRUD server actions (create, rename, delete, reorder)"
  - "Article CRUD server actions (create, rename, delete, move)"
  - "@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities packages"
  - "shadcn Select UI component"
affects: [10-02, 10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core 6.3.1", "@dnd-kit/sortable 10.0.0", "@dnd-kit/utilities 3.2.2", "shadcn Select"]
  patterns: ["Admin-only server actions with auth() guard", "Slug generation with conflict resolution", "Category depth enforcement (max 2 levels)", "Batch reorder with depth validation"]

key-files:
  created:
    - "src/lib/wiki/category-actions.ts"
    - "src/lib/wiki/article-actions.ts"
    - "src/components/ui/select.tsx"
  modified:
    - "package.json"

key-decisions:
  - "Slug generation reuses same pattern as pipeline.ts (lowercase, replace non-alphanumeric, trim hyphens, slice 120)"
  - "renameArticle does NOT change slug to keep URLs stable"
  - "deleteArticle explicitly deletes all related records before article for safety even though schema has cascades"
  - "createCategory uses onConflictDoNothing for slug races, then looks up existing"

patterns-established:
  - "Server action return type: { success: true } | { error: string } for mutations, { id, slug } | { error } for creates"
  - "Admin auth guard pattern: session?.user?.role !== 'admin' -> return error"
  - "Category depth enforcement: parent must have no parentCategoryId"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 10 Plan 01: Server Actions and Dependencies Summary

**8 admin-only server actions for category/article CRUD with depth enforcement and slug conflict handling, plus @dnd-kit and shadcn Select dependencies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T16:49:53Z
- **Completed:** 2026-02-15T16:52:29Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Installed @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/utilities 3.2.2 for upcoming drag-and-drop sidebar
- Created 4 category server actions: createCategory (with depth-2 enforcement and slug conflict handling), renameCategory (with slug regeneration), deleteCategory (with article guard and child cleanup), reorderSidebarItems (batch update with depth validation)
- Created 4 article server actions: createArticle (with unique slug and initial version), renameArticle (title-only, stable URLs), deleteArticle (with explicit related record cleanup), moveArticle (with target category verification)
- Added shadcn Select component for category/subcategory dropdowns in the create article modal

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and add Select component** - `6a5d37f` (chore)
2. **Task 2: Create category server actions** - `188b1ce` (feat)
3. **Task 3: Create article server actions** - `754e60e` (feat)

## Files Created/Modified
- `src/lib/wiki/category-actions.ts` - Server actions for category CRUD (createCategory, renameCategory, deleteCategory, reorderSidebarItems) with admin auth, depth enforcement, and slug conflict resolution
- `src/lib/wiki/article-actions.ts` - Server actions for article CRUD (createArticle, renameArticle, deleteArticle, moveArticle) with admin auth, unique slug generation, and related record cleanup
- `src/components/ui/select.tsx` - shadcn Select component for category/subcategory dropdowns
- `package.json` - Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities dependencies

## Decisions Made
- Slug generation reuses the same pattern as pipeline.ts (lowercase, replace non-alphanumeric with hyphens, trim leading/trailing hyphens, slice to 120 chars) for consistency across the codebase
- renameArticle updates title only, does NOT regenerate slug -- URLs should remain stable after creation
- deleteArticle explicitly cleans up all FK references (mentions, comments, annotations, bookmarks, versions, file links, DB tables) before deleting the article, even though many have onDelete cascade in the schema -- this is defensive against any missing cascade constraints
- createCategory uses onConflictDoNothing on slug insert, then looks up existing record on conflict (same race condition pattern as pipeline.ts resolveOrCreateCategory)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 server actions are type-checked and ready for consumption by UI plans (10-02 through 10-05)
- @dnd-kit packages installed and ready for sortable sidebar implementation in plan 10-03
- shadcn Select component available for create article modal in plan 10-04

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 10-navigation-and-article-creation*
*Completed: 2026-02-15*
