---
phase: 05-article-editing
plan: 01
subsystem: editor
tags: [blocknote, wysiwyg, rich-text, localstorage, optimistic-locking, version-history]

# Dependency graph
requires:
  - phase: 04-wiki-viewer
    provides: Article pages, sidebar, breadcrumbs, bookmark/regenerate buttons
  - phase: 03-ai-pipeline
    provides: createArticleVersion function, contentJson/contentMarkdown schema columns
provides:
  - BlockNote WYSIWYG editor at /wiki/[articleSlug]/edit
  - Save API with optimistic locking and version tracking
  - localStorage auto-save drafts with recovery UI
  - Edit button on article pages for authenticated users
affects: [05-02 image-upload, 05-03 version-history-ui, 05-04 ai-review-annotations]

# Tech tracking
tech-stack:
  added: ["@blocknote/core@0.46.2", "@blocknote/react@0.46.2", "@blocknote/shadcn@0.46.2"]
  patterns: [client-component-dynamic-import-wrapper, localstorage-draft-autosave, optimistic-locking-via-timestamp]

key-files:
  created:
    - src/components/editor/article-editor.tsx
    - src/components/editor/editor-save-dialog.tsx
    - src/components/editor/editor-loader.tsx
    - src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx
    - src/app/api/articles/[id]/save/route.ts
    - src/components/ui/dialog.tsx
  modified:
    - package.json
    - src/app/globals.css
    - src/lib/wiki/queries.ts
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx

key-decisions:
  - "EditorLoader client wrapper for ssr:false dynamic import -- Next.js 16 disallows ssr:false in server components"
  - "Draft auto-save to localStorage on every BlockNote onChange event"
  - "Optimistic locking via ISO timestamp comparison prevents stale saves (409 response)"

patterns-established:
  - "Client wrapper pattern: create 'use client' EditorLoader that calls next/dynamic with ssr:false, then use EditorLoader from server components"
  - "Draft recovery: show restore/discard banner on mount when localStorage draft exists"
  - "Editor save flow: BlockNoteView -> Save button -> EditorSaveDialog -> fetch POST -> clear draft"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 5 Plan 1: BlockNote WYSIWYG Editor Summary

**BlockNote WYSIWYG editor with native JSON storage, localStorage draft auto-save, optimistic-locking save API, and version tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T02:45:45Z
- **Completed:** 2026-02-14T02:50:28Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- BlockNote editor renders at /wiki/[articleSlug]/edit with full toolbar (headings, bold, italic, code, links, tables, lists)
- Editor loads contentJson directly when available, converts contentMarkdown client-side when contentJson is null
- localStorage draft auto-saves on every change with restore/discard recovery banner
- Save creates article_versions record with change_source "human_edited" and updates article with both contentJson and contentMarkdown
- Optimistic locking returns 409 on stale save attempts
- Edit button visible to all authenticated users on article pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Install BlockNote packages and configure Tailwind** - `7b1a75e` (chore)
2. **Task 2: Create BlockNote editor component, edit page, save API, and Edit button** - `efa6e2d` (feat)

## Files Created/Modified
- `src/components/editor/article-editor.tsx` - BlockNote WYSIWYG editor client component with draft auto-save and save handler
- `src/components/editor/editor-save-dialog.tsx` - Save dialog with optional change summary prompt
- `src/components/editor/editor-loader.tsx` - Client wrapper for ssr:false dynamic import (Next.js 16 compatibility)
- `src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx` - Server component edit page with auth guard and breadcrumbs
- `src/app/api/articles/[id]/save/route.ts` - POST endpoint with optimistic locking, version tracking, and hasHumanEdits flag
- `src/components/ui/dialog.tsx` - shadcn dialog component (new dependency)
- `package.json` - Added @blocknote/core, @blocknote/react, @blocknote/shadcn at 0.46.2
- `src/app/globals.css` - Added @source directive for Tailwind v4 to scan BlockNote shadcn classes
- `src/lib/wiki/queries.ts` - Added contentJson to getArticleBySlug select fields
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Added Edit button (Pencil icon) for authenticated users

## Decisions Made
- **EditorLoader client wrapper**: Next.js 16 (Turbopack) disallows `ssr: false` in `next/dynamic` calls within server components. Created a `"use client"` EditorLoader wrapper that handles the dynamic import, then used it from the server page.
- **Draft auto-save on onChange**: Every BlockNote change event serializes editor.document to localStorage. Simple, immediate, no debounce needed (BlockNote batches changes internally).
- **Optimistic locking via ISO timestamp**: Compare `article.updatedAt.toISOString()` with `loadedUpdatedAt` from the editor. Any external modification changes updatedAt, causing a 409 response with a clear message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created EditorLoader client wrapper for ssr:false dynamic import**
- **Found during:** Task 2 (build verification)
- **Issue:** Next.js 16 Turbopack errors on `ssr: false` in `next/dynamic` when used in server components. The plan specified using dynamic import directly in the server component edit page.
- **Fix:** Created `src/components/editor/editor-loader.tsx` as a `"use client"` component that wraps the dynamic import with `ssr: false`, then imported EditorLoader from the server page.
- **Files modified:** src/components/editor/editor-loader.tsx (new), src/app/(wiki)/wiki/[articleSlug]/edit/page.tsx (simplified)
- **Verification:** `npm run build` passes cleanly, /wiki/[articleSlug]/edit route registered
- **Committed in:** efa6e2d (Task 2 commit)

**2. [Rule 3 - Blocking] Installed shadcn dialog component**
- **Found during:** Task 2 (EditorSaveDialog requires Dialog component)
- **Issue:** shadcn dialog component was not yet installed in the project
- **Fix:** Ran `npx shadcn@latest add dialog` to install the dialog UI component
- **Files modified:** src/components/ui/dialog.tsx (new)
- **Committed in:** efa6e2d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for build success. No scope creep. EditorLoader pattern is standard for Next.js 16+ projects.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Editor foundation complete, ready for Plan 02 (image upload integration via uploadFile prop)
- Save API and version tracking operational for Plan 03 (version history UI)
- contentJson now populated on human edits, enabling future diff/comparison features

## Self-Check: PASSED

All 7 created files verified present. Both task commits (7b1a75e, efa6e2d) verified in git log.

---
*Phase: 05-article-editing*
*Plan: 01*
*Completed: 2026-02-14*
