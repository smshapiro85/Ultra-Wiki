---
phase: 05-article-editing
plan: 03
subsystem: ui, api
tags: [version-history, diff-viewer, rollback, filtering, diff-library, inline-diff, side-by-side-diff]

# Dependency graph
requires:
  - phase: 05-article-editing
    provides: "BlockNote editor with save API and version tracking (05-01)"
  - phase: 04-wiki-viewer
    provides: "Article page with tabs, breadcrumbs, sidebar layout"
  - phase: 03-ai-pipeline
    provides: "createArticleVersion function, article_versions schema"
provides:
  - "Version history UI with source filtering and version comparison"
  - "Diff viewer with inline and side-by-side modes"
  - "GET /api/articles/[id]/versions with optional source filter"
  - "POST /api/articles/[id]/restore for non-destructive rollback"
  - "Active History tab on article page"
affects: [06-technical-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: ["client-side diff computation via diff library diffLines", "selection-based compare/restore UX with confirmation dialog", "inArray with typed enum values for Drizzle source filtering"]

key-files:
  created:
    - src/components/wiki/diff-viewer.tsx
    - src/components/wiki/version-history.tsx
    - src/app/api/articles/[id]/versions/route.ts
    - src/app/api/articles/[id]/restore/route.ts
  modified:
    - src/lib/wiki/queries.ts
    - src/components/wiki/article-tabs.tsx
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx

key-decisions:
  - "Client-side diff computation -- articles are small (tens of KB), so contentMarkdown is sent with each version and diffLines runs in the browser"
  - "Selection-based UX: click version cards to select (up to 2), Compare button for diff, Restore button for single selection"
  - "Typed enum cast for Drizzle inArray on changeSource enum column"

patterns-established:
  - "Version selection pattern: click cards to toggle selection, action buttons appear contextually (1 selected = Restore, 2 selected = Compare)"
  - "Diff rendering: diffLines from diff library, dual-gutter line numbers for inline, aligned left/right columns for side-by-side"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 5 Plan 3: Version History & Diff Viewer Summary

**Version history UI with source filtering, inline/side-by-side diff viewer, and non-destructive rollback via API endpoints**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T02:53:01Z
- **Completed:** 2026-02-14T02:56:57Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- History tab active on article page showing all version records with date, source badge, creator name, and change summary
- Source filter buttons (All, AI Generated, Human Edited, AI Merged, AI Updated) re-fetch version list from API
- Two-version selection enables Compare button rendering inline or side-by-side diff with colored additions/removals
- Single-version selection enables Restore button with confirmation dialog; rollback creates new version (history is never destructive)
- API endpoints for version listing (GET with optional source filter) and restore (POST creating new version record)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create version listing and restore API endpoints** - `688ee00` (feat)
2. **Task 2: Create version history UI, diff viewer, and activate History tab** - `76a2d08` (feat)

## Files Created/Modified
- `src/app/api/articles/[id]/versions/route.ts` - GET endpoint listing versions with optional changeSource filter and user join
- `src/app/api/articles/[id]/restore/route.ts` - POST endpoint for non-destructive rollback creating new version record
- `src/lib/wiki/queries.ts` - Added getArticleVersions query with inArray source filtering and users join
- `src/components/wiki/diff-viewer.tsx` - Diff viewer with inline (dual-gutter line numbers) and side-by-side (aligned columns) modes
- `src/components/wiki/version-history.tsx` - Full version history panel with filtering, selection, compare, restore, and loading/empty states
- `src/components/wiki/article-tabs.tsx` - History tab enabled, historyContent prop added
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - VersionHistory component passed to History tab

## Decisions Made
- **Client-side diff computation**: contentMarkdown included in version API response so diffs are computed in the browser with diffLines. Articles are small enough that this avoids server-side diff computation complexity.
- **Selection-based UX**: Instead of separate radio buttons or checkboxes, clicking a version card toggles selection. Max 2 selections. Action buttons appear contextually: 1 selected shows Restore, 2 selected shows Compare.
- **Typed enum cast for Drizzle inArray**: The changeSource column is a PgEnum, so the source filter array needs explicit typing as the union of enum values to satisfy Drizzle's type system.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Version history, diff viewing, and rollback are fully operational
- All four Phase 5 plans (editor, image upload, version history, AI review annotations) are now complete
- Ready for Phase 6 (Technical Comments)

## Self-Check: PASSED

All 4 created files verified present. Both task commits (688ee00, 76a2d08) verified in git log.

---
*Phase: 05-article-editing*
*Plan: 03*
*Completed: 2026-02-14*
