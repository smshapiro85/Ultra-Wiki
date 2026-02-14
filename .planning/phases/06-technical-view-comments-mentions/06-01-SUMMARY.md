---
phase: 06-technical-view-comments-mentions
plan: 01
subsystem: ui
tags: [shiki, code-viewer, technical-view, github-api, tabs, drizzle, server-components]

# Dependency graph
requires:
  - phase: 03-ai-pipeline
    provides: "article_file_links and article_db_tables populated during sync"
  - phase: 05-article-editing
    provides: "BlockNote editor, save API route, version history"
provides:
  - "TechnicalView server component with file links and DB table cards"
  - "CodeViewerDialog client component for inline syntax-highlighted code viewing"
  - "GET /api/github/file-content endpoint with shiki highlighting"
  - "getArticleFileLinks and getArticleDbTables query functions"
  - "inferLanguage helper for file extension to shiki language mapping"
  - "Technical view editing via ?mode=technical on edit page"
  - "Comments tab enabled and accepting content (placeholder for Plan 02)"
affects: [06-02-comments-mentions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "On-demand file content fetching via API route with server-side shiki highlighting"
    - "saveMode prop pattern for dual-purpose editor (article vs technical view)"
    - "Server component with parallel data fetching (queries + auth + repo config)"

key-files:
  created:
    - src/lib/github/language.ts
    - src/app/api/github/file-content/route.ts
    - src/components/wiki/technical-view.tsx
    - src/components/wiki/file-link-card.tsx
    - src/components/wiki/code-viewer-dialog.tsx
    - src/components/wiki/db-table-card.tsx
  modified:
    - src/lib/wiki/queries.ts
    - src/components/wiki/article-tabs.tsx
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx
    - src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx
    - src/components/editor/editor-loader.tsx
    - src/components/editor/article-editor.tsx
    - src/app/api/articles/[id]/save/route.ts

key-decisions:
  - "API route approach for code viewing -- shiki highlights server-side, returns HTML, avoids shipping shiki to client bundle"
  - "saveMode prop on editor rather than separate editor component -- reuses existing BlockNote editor for technical view editing"
  - "Technical view saves create version records with contentMarkdown from current article (preserves version continuity)"

patterns-established:
  - "On-demand GitHub file fetch pattern: API route with auth, retry, size guard, shiki highlighting"
  - "Dual-mode editor: saveMode prop controls which field the save API updates"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 6 Plan 01: Technical View Summary

**Technical View tab with file link cards, inline code viewer dialog via shiki, DB table cards, GitHub deep links, and dual-mode editor for technical view editing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T04:33:43Z
- **Completed:** 2026-02-14T04:37:45Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Technical View tab displays structured file link cards with relevance explanations and GitHub deep links
- Code viewer dialog fetches file content from GitHub on-demand and renders with shiki syntax highlighting
- DB table cards show table names, column details, and relevance notes
- Technical view markdown is editable via the same BlockNote editor with `?mode=technical` URL param
- Comments tab enabled (no longer disabled) and accepts content prop for Plan 02
- Save API route supports `mode: "technical"` for updating technicalViewMarkdown field

## Task Commits

Each task was committed atomically:

1. **Task 1: Data queries, language helper, and GitHub file content API route** - `2e3e8ed` (feat)
2. **Task 2: Technical View UI components, tabs update, and article page wiring** - `c743ecf` (feat)

## Files Created/Modified
- `src/lib/wiki/queries.ts` - Added getArticleFileLinks and getArticleDbTables query functions
- `src/lib/github/language.ts` - File extension to shiki language ID mapping helper
- `src/app/api/github/file-content/route.ts` - GET endpoint fetching file from GitHub with shiki highlighting
- `src/components/wiki/technical-view.tsx` - Server component rendering file links and DB tables sections
- `src/components/wiki/file-link-card.tsx` - Client card with GitHub deep link and View Code button
- `src/components/wiki/code-viewer-dialog.tsx` - Client dialog with syntax-highlighted code, loading/error states
- `src/components/wiki/db-table-card.tsx` - Card displaying related DB table with column details
- `src/components/wiki/article-tabs.tsx` - Added commentsContent prop, enabled Comments tab
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Wired TechnicalView component and comments placeholder
- `src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx` - Added ?mode=technical support with searchParams
- `src/components/editor/editor-loader.tsx` - Added saveMode prop passthrough
- `src/components/editor/article-editor.tsx` - Added saveMode prop, sends mode in save request
- `src/app/api/articles/[id]/save/route.ts` - Added mode=technical handling for technical view saves

## Decisions Made
- API route approach for code viewing: shiki highlights server-side, returns HTML via dangerouslySetInnerHTML -- avoids shipping shiki WASM to client bundle
- saveMode prop on existing editor rather than creating a separate technical view editor -- maximizes code reuse
- Technical view saves store version records preserving the current article contentMarkdown alongside the technical view change, maintaining version history continuity
- 500KB file size limit for inline code viewing -- files beyond this get a "View on GitHub" fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Comments tab is enabled and accepts content -- ready for Plan 02 (comments and mentions)
- Technical View fully functional with file links, code viewer, DB tables, editing
- All existing functionality (Article tab, History tab, bookmarks, annotations) verified working via build

## Self-Check: PASSED

All 13 files verified present. Both task commits (2e3e8ed, c743ecf) found in git history. Build succeeds with no TypeScript errors.

---
*Phase: 06-technical-view-comments-mentions*
*Completed: 2026-02-14*
