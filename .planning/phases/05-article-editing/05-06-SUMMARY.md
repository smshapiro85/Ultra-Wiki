---
phase: 05-article-editing
plan: 06
subsystem: editor, api, database
tags: [drafts, auto-save, version-history, blocknote, debounce]

# Dependency graph
requires:
  - phase: 05-article-editing
    provides: "Editor with BlockNote, version history with change source filtering, article save API"
provides:
  - "Server-side draft auto-save via changeSource 'draft' version records"
  - "Draft API route (GET/PUT/DELETE) at /api/articles/[id]/draft"
  - "Draft badge and dashed-border styling in version history"
  - "One draft per user per article upsert pattern"
affects: [05-article-editing, version-history]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Debounced server-side draft auto-save (3s) replacing localStorage", "Upsert pattern for one-per-user-per-article draft version records"]

key-files:
  created:
    - src/app/api/articles/[id]/draft/route.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/content/version.ts
    - src/lib/wiki/queries.ts
    - src/components/editor/article-editor.tsx
    - src/components/wiki/version-history.tsx

key-decisions:
  - "Drafts as version records with changeSource 'draft' -- one per user per article, upsert pattern"
  - "3-second debounce for draft auto-save to avoid excessive server requests"
  - "Draft cleanup on successful save via DELETE call after save completes"

patterns-established:
  - "Upsert draft: check existing draft by articleId+changeSource+createdBy, update if found, insert if not"
  - "Debounced server-side auto-save: useRef timeout + useCallback pattern"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 5 Plan 6: Server-Side Draft Auto-Save Summary

**Server-side draft version records replacing localStorage with upsert pattern, debounced auto-save, and draft styling in version history**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T06:01:17Z
- **Completed:** 2026-02-14T06:04:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added "draft" to changeSourceEnum and pushed DB migration
- Created draft API route with GET (fetch), PUT (upsert), and DELETE (discard) endpoints
- Replaced all localStorage draft code in editor with debounced server-side auto-save (3s)
- Draft recovery banner now checks server instead of localStorage
- Version history shows drafts with FileEdit icon badge, dashed border, and reduced opacity
- Draft filter option available in version history source filters

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 'draft' to changeSourceEnum and create draft API route** - `00ee968` (feat)
2. **Task 2: Replace localStorage drafts with server-side drafts in editor and add draft styling to version history** - `afecebd` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - Added "draft" to changeSourceEnum
- `src/lib/content/version.ts` - Updated changeSource union type to include "draft"
- `src/lib/wiki/queries.ts` - Updated validSources type cast to include "draft"
- `src/app/api/articles/[id]/draft/route.ts` - New draft API route (GET/PUT/DELETE)
- `src/components/editor/article-editor.tsx` - Replaced localStorage with server-side draft auto-save
- `src/components/wiki/version-history.tsx` - Added Draft filter, badge, and dashed border styling

## Decisions Made
- Drafts stored as version records with changeSource "draft" -- survives browser clears, previewable in history
- 3-second debounce for draft auto-save balances responsiveness with server load
- Draft cleanup happens after successful save via DELETE call (non-blocking)
- Draft save failures silently ignored (non-critical path)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Database migration was pushed via drizzle-kit push.

## Next Phase Readiness
- Draft system fully operational for server-side persistence
- Version history displays drafts with distinct styling
- Ready for remaining gap closure plans (05-07, 05-08)

## Self-Check: PASSED

- All 6 modified/created files verified on disk
- Commits 00ee968 and afecebd verified in git log
- `npx tsc --noEmit` passes
- `npm run build` succeeds
- No localStorage references in article-editor.tsx
- Draft route listed in build output

---
*Phase: 05-article-editing*
*Completed: 2026-02-14*
