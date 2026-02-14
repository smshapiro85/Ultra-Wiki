---
phase: 06-technical-view-comments-mentions
plan: 02
subsystem: ui
tags: [comments, mentions, react-mentions-ts, threaded-comments, markdown, drizzle, api-routes]

# Dependency graph
requires:
  - phase: 06-technical-view-comments-mentions
    plan: 01
    provides: "Comments tab enabled in ArticleTabs, accepting commentsContent prop"
  - phase: 01-foundation
    provides: "comments and mentions tables in schema, users table with avatarUrl"
provides:
  - "Threaded comment system with one level of reply nesting"
  - "Markdown rendering in comment bodies with GFM support"
  - "@mention autocomplete via react-mentions-ts with user search API"
  - "Mention records stored in mentions table on comment creation"
  - "Resolve/unresolve toggle with visual feedback"
  - "GET/POST /api/articles/[id]/comments endpoints"
  - "POST /api/articles/[id]/comments/[commentId]/resolve endpoint"
  - "GET /api/users/search endpoint for mention autocomplete"
  - "getArticleComments and searchUsers query functions"
affects: [07-ask-ai-notifications]

# Tech tracking
tech-stack:
  added: [react-mentions-ts]
  patterns:
    - "Server-side comment tree building with Map-based parent-child assignment"
    - "Mention markup parsing: @[display](id) regex extraction for mention records"
    - "CSS classNames-based styling for react-mentions-ts (no inline style objects)"

key-files:
  created:
    - src/app/api/articles/[id]/comments/route.ts
    - src/app/api/articles/[id]/comments/[commentId]/resolve/route.ts
    - src/app/api/users/search/route.ts
    - src/components/wiki/comment-card.tsx
    - src/components/wiki/comment-thread.tsx
    - src/components/wiki/comment-input.tsx
    - src/components/wiki/comments-section.tsx
  modified:
    - src/lib/wiki/queries.ts
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx
    - src/app/globals.css

key-decisions:
  - "CSS classNames approach for react-mentions-ts styling instead of inline style objects -- integrates with CSS variables for dark mode"
  - "Single-level reply threading enforced in UI (replies do not show Reply button) while schema supports deeper nesting"
  - "Mention markup processed before Markdown rendering: @[display](id) converted to **@display** bold text"

patterns-established:
  - "Comment tree building: Map-based server-side tree construction from flat query results"
  - "Mention extraction: regex parsing of react-mentions-ts markup for creating mention records"
  - "classNames-based react-mentions-ts integration with Tailwind CSS variables"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 6 Plan 02: Comments & Mentions Summary

**Threaded comments with Markdown rendering, resolve/unresolve toggle, and react-mentions-ts @mention autocomplete creating mention records in the database**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T04:39:56Z
- **Completed:** 2026-02-14T04:44:07Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Threaded comments with one level of reply nesting fully functional on the Comments tab
- Markdown rendering in comment bodies with GFM support via react-markdown and remark-gfm
- @mention autocomplete triggers on @ character with user search dropdown
- Mention records created in mentions table when comments contain @mentions
- Resolve/unresolve toggle with visual state change (green border/badge for resolved comments)
- User avatar, display name, and relative timestamp shown on every comment

## Task Commits

Each task was committed atomically:

1. **Task 1: Comment API routes, user search API, and query functions** - `49656e3` (feat)
2. **Task 2: Comment UI components, mention input, and article page wiring** - `2c16f2d` (feat)

## Files Created/Modified
- `src/lib/wiki/queries.ts` - Added getArticleComments (tree-building) and searchUsers (ILIKE) query functions
- `src/app/api/articles/[id]/comments/route.ts` - GET (list comment tree) and POST (create with mention extraction)
- `src/app/api/articles/[id]/comments/[commentId]/resolve/route.ts` - POST toggle resolve/unresolve
- `src/app/api/users/search/route.ts` - GET user search for @mention autocomplete
- `src/components/wiki/comment-card.tsx` - Single comment with avatar, name, timestamp, Markdown body, resolve, reply
- `src/components/wiki/comment-thread.tsx` - Root comment with indented replies (one level)
- `src/components/wiki/comment-input.tsx` - Textarea with react-mentions-ts @mention autocomplete
- `src/components/wiki/comments-section.tsx` - Orchestrator managing comment list, posting, replying, resolving
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Wired CommentsSection replacing placeholder
- `src/app/globals.css` - Added react-mentions-ts CSS styling with CSS variable integration

## Decisions Made
- CSS classNames approach for react-mentions-ts rather than inline style objects -- integrates naturally with CSS variables for dark mode support
- Single-level reply threading enforced in UI: replies do not show the Reply button, preventing deeply nested threads while the schema supports deeper nesting for future flexibility
- Mention markup converted to bold text (`**@display**`) before Markdown rendering for display, while raw markup preserved in storage for re-editing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Comments tab fully functional with threaded comments, @mentions, and resolve/unresolve
- Mention records stored in mentions table ready for Phase 7 notification hooks
- All article tabs now active (Article, Technical View, Comments, History)
- Phase 6 complete -- ready for Phase 7 (Ask AI & Notifications)

## Self-Check: PASSED

All 10 files verified present. Both task commits (49656e3, 2c16f2d) found in git history. Build succeeds with no TypeScript errors.

---
*Phase: 06-technical-view-comments-mentions*
*Completed: 2026-02-14*
