---
phase: 04-wiki-viewer
plan: 02
subsystem: ui
tags: [react-markdown, shiki, rehype, syntax-highlighting, table-of-contents, tabs, metadata, regenerate, three-way-merge, server-action]

# Dependency graph
requires:
  - phase: 04-wiki-viewer
    plan: 01
    provides: "Wiki data access layer (getArticleBySlug, getCategoryChain), ArticleBreadcrumb, sidebar layout, shiki CSS"
  - phase: 03-ai-processing-pipeline
    provides: "AI pipeline (generateArticle, fetchFileContents), merge strategy (three-way, conflict resolution), version tracking"
provides:
  - "Article page at /wiki/[articleSlug] with Markdown rendering, syntax highlighting, TOC, tabs, metadata"
  - "ArticleContent async server component with shiki dual-theme code highlighting"
  - "TableOfContents with extractToc() heading parser and sticky anchor sidebar"
  - "ArticleTabs four-tab system (Article, Technical View, Comments placeholder, History placeholder)"
  - "ArticleMetadata panel with category badge, dates, AI/human source badge, editor name, review warning"
  - "RegenerateButton admin-only client component with server action"
  - "regenerateArticle server action with merge strategy awareness"
affects: [04-03-home-dashboard, 05-editor, 06-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-server-component-markdown, dynamic-import-ai-modules, useTransition-server-action, heading-slugify-toc-matching]

key-files:
  created:
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx
    - src/components/wiki/article-content.tsx
    - src/components/wiki/table-of-contents.tsx
    - src/components/wiki/article-tabs.tsx
    - src/components/wiki/article-metadata.tsx
    - src/components/wiki/regenerate-button.tsx
  modified:
    - src/lib/wiki/actions.ts

key-decisions:
  - "MarkdownAsync named export from react-markdown v10 for async rehype plugin support in RSC"
  - "Heading IDs generated via shared slugify function (table-of-contents exports, article-content imports) for TOC anchor matching"
  - "Inline style paddingLeft for TOC indentation instead of dynamic Tailwind classes (avoids JIT purge issues)"
  - "Dynamic imports for all AI/merge modules in regenerateArticle to avoid BlockNote createContext crash"
  - "regenerateArticle appended to existing actions.ts alongside toggleBookmark"

patterns-established:
  - "Async server component pattern: ArticleContent uses MarkdownAsync for server-side shiki rendering"
  - "Shared slugify function between TOC extraction and heading ID generation ensures anchor links work"
  - "Server action with dynamic imports pattern for modules with problematic transitive dependencies"
  - "useTransition + sonner toast pattern for server action loading/feedback in client components"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 4 Plan 02: Article Page Summary

**Article viewer at /wiki/[articleSlug] with shiki-highlighted Markdown, auto-generated TOC, four-tab system, metadata sidebar, and admin regenerate action with merge strategy awareness**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T01:31:19Z
- **Completed:** 2026-02-14T01:34:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built article page route with breadcrumb navigation, title, review banner, and responsive layout
- Created async server component ArticleContent using react-markdown v10 MarkdownAsync + shiki dual-theme syntax highlighting
- Implemented TOC extraction from Markdown headings with matching slugified anchor IDs on rendered headings
- Built four-tab UI system: Article (default), Technical View (active), Comments (disabled/Phase 6), History (disabled/Phase 5)
- Created metadata sidebar panel showing category badge, last updated date, AI/human source badge, editor name, and merge conflict warning
- Implemented regenerateArticle server action with full merge strategy: direct overwrite for AI-only, three-way merge for human-edited articles
- Created RegenerateButton client component with useTransition loading state and sonner toast feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Article content renderer, TOC, tabs, and metadata components** - `dd3fac6` (feat)
2. **Task 2: Article page route, regenerate action, and regenerate button** - `e42feb6` (feat)

## Files Created/Modified
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Article page route with data fetching and component assembly
- `src/components/wiki/article-content.tsx` - Async server component: MarkdownAsync + shiki + heading ID generation
- `src/components/wiki/table-of-contents.tsx` - extractToc() heading parser + sticky TOC sidebar + slugify export
- `src/components/wiki/article-tabs.tsx` - Client component: four-tab system with shadcn Tabs
- `src/components/wiki/article-metadata.tsx` - Server component: metadata panel with badges, dates, review warning
- `src/components/wiki/regenerate-button.tsx` - Client component: admin regenerate button with loading state
- `src/lib/wiki/actions.ts` - Added regenerateArticle server action with dynamic imports and merge strategy

## Decisions Made
- Used `MarkdownAsync` named export (react-markdown v10) instead of default export for async rehype plugin support in RSC
- Heading IDs generated via shared `slugify()` function exported from table-of-contents.tsx, ensuring TOC anchor links match rendered heading elements
- Used inline `paddingLeft` style for TOC level indentation instead of dynamic Tailwind classes to avoid JIT purge issues
- All AI/merge module imports in `regenerateArticle` are dynamic to prevent BlockNote createContext crash in module graph
- Appended `regenerateArticle` to existing `src/lib/wiki/actions.ts` alongside existing `toggleBookmark` action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Article page fully functional, ready for Plan 03 (home dashboard with recent articles, search)
- ArticleContent component reusable for any Markdown rendering needs
- regenerateArticle action ready for use by future admin tools
- Tab system extensible: Comments tab (Phase 6) and History tab (Phase 5) have disabled placeholders

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (dd3fac6, e42feb6) verified in git log. `npm run build` passed successfully.

---
*Phase: 04-wiki-viewer*
*Completed: 2026-02-14*
