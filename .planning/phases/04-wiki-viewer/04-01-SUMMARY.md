---
phase: 04-wiki-viewer
plan: 01
subsystem: ui
tags: [shadcn-sidebar, breadcrumb, collapsible, shiki, react-markdown, tailwind-typography, drizzle, full-text-search]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Database schema (categories, articles tables), auth, user model"
  - phase: 03-ai-processing-pipeline
    provides: "Articles and categories populated via AI pipeline"
provides:
  - "SidebarProvider-based wiki layout with collapsible category/article tree"
  - "ArticleBreadcrumb component for article page headers"
  - "Wiki data access layer (getCategoryTreeWithArticles, getArticleBySlug, getCategoryChain, searchArticles, getRecentArticles)"
  - "Shiki dual-theme CSS and Tailwind Typography plugin configured"
  - "shadcn sidebar, breadcrumb, collapsible, tooltip, skeleton, sheet components"
affects: [04-02-article-page, 04-03-home-dashboard]

# Tech tracking
tech-stack:
  added: [react-markdown, remark-gfm, shiki, "@shikijs/rehype", use-debounce, "@tailwindcss/typography", shadcn-sidebar, shadcn-breadcrumb, shadcn-collapsible, shadcn-tooltip, shadcn-skeleton, shadcn-sheet]
  patterns: [SidebarProvider-layout, recursive-category-tree, server-component-breadcrumb, map-based-tree-building]

key-files:
  created:
    - src/lib/wiki/queries.ts
    - src/components/wiki/category-tree.tsx
    - src/components/wiki/app-sidebar.tsx
    - src/components/wiki/article-breadcrumb.tsx
    - src/components/ui/sidebar.tsx
    - src/components/ui/breadcrumb.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/sheet.tsx
    - src/hooks/use-mobile.ts
  modified:
    - src/app/(wiki)/layout.tsx
    - src/app/(wiki)/page.tsx
    - src/app/globals.css
    - package.json

key-decisions:
  - "@plugin syntax for @tailwindcss/typography in Tailwind v4 CSS-first config"
  - "CategoryTree as client component (interactive Collapsible state), layout remains server component"
  - "Categories use href='#' in breadcrumbs (no standalone category pages)"
  - "Empty state message in CategoryTree for when no categories exist yet"

patterns-established:
  - "SidebarProvider + AppSidebar + SidebarInset layout pattern for all wiki pages"
  - "Recursive CategoryNode pattern for tree rendering with collapsible sections"
  - "Server component breadcrumb receiving segments from getCategoryChain()"
  - "Map-based tree building: flat fetch, Map construction, parent-child assembly"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 4 Plan 01: Wiki App Shell Summary

**SidebarProvider-based wiki layout with collapsible category/article tree, breadcrumb component, and 5-function data access layer for articles, categories, and search**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T01:25:21Z
- **Completed:** 2026-02-14T01:28:40Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Installed all npm dependencies for wiki viewer and future article rendering (react-markdown, shiki, remark-gfm, etc.)
- Added 6 shadcn UI components (sidebar, breadcrumb, collapsible, tooltip, skeleton, sheet) plus use-mobile hook
- Created data access layer with getCategoryTreeWithArticles, getArticleBySlug, getCategoryChain, searchArticles, getRecentArticles
- Built recursive CategoryTree with collapsible categories and active article highlighting
- Created AppSidebar with logo, category navigation, and UserMenu in footer
- Created ArticleBreadcrumb server component for hierarchical page breadcrumbs
- Reworked wiki layout from simple nav+main to SidebarProvider with collapsible sidebar
- Configured Tailwind Typography plugin and Shiki dual-theme CSS for markdown rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, add shadcn components, and create data access layer** - `16e941e` (feat)
2. **Task 2: Build sidebar, category tree, breadcrumb, and rework wiki layout** - `34fbfc2` (feat)

## Files Created/Modified
- `src/lib/wiki/queries.ts` - Data access layer with 5 query functions for categories, articles, search
- `src/components/wiki/category-tree.tsx` - Recursive collapsible category/article tree (client component)
- `src/components/wiki/app-sidebar.tsx` - Sidebar with logo, navigation tree, UserMenu footer (client component)
- `src/components/wiki/article-breadcrumb.tsx` - Breadcrumb from category hierarchy (server component)
- `src/app/(wiki)/layout.tsx` - Reworked to SidebarProvider + AppSidebar + SidebarInset
- `src/app/(wiki)/page.tsx` - Simplified placeholder (auth handled by layout)
- `src/app/globals.css` - Added @tailwindcss/typography plugin and Shiki dual-theme CSS
- `src/components/ui/sidebar.tsx` - shadcn sidebar component
- `src/components/ui/breadcrumb.tsx` - shadcn breadcrumb component
- `src/components/ui/collapsible.tsx` - shadcn collapsible component
- `src/components/ui/tooltip.tsx` - shadcn tooltip component
- `src/components/ui/skeleton.tsx` - shadcn skeleton component
- `src/components/ui/sheet.tsx` - shadcn sheet component
- `src/hooks/use-mobile.ts` - Mobile detection hook (peer dep of sidebar)

## Decisions Made
- Used `@plugin "@tailwindcss/typography"` syntax (Tailwind v4 CSS-first config, not `@import`)
- CategoryTree is a client component (needed for Collapsible interactive state and usePathname active highlighting)
- Categories use `href="#"` in breadcrumbs since they have no standalone pages
- Added empty state message in CategoryTree when no categories exist
- Simplified home page by removing redundant auth/user query (layout handles auth)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wiki app shell is ready for Plan 02 (article viewer page) and Plan 03 (home dashboard)
- Data access layer provides all query functions needed by both plans
- ArticleBreadcrumb component ready to be used on article pages with getCategoryChain
- Shiki and typography CSS configured for markdown rendering in Plan 02

## Self-Check: PASSED

All 13 created/modified files verified on disk. Both task commits (16e941e, 34fbfc2) verified in git log. `npm run build` passed successfully.

---
*Phase: 04-wiki-viewer*
*Completed: 2026-02-14*
