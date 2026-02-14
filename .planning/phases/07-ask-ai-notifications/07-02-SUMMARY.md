---
phase: 07-ask-ai-notifications
plan: 02
subsystem: ai, ui
tags: [ai-sdk, streaming, article-context, chat, context-indicator, openrouter]

# Dependency graph
requires:
  - phase: 07-ask-ai-notifications
    plan: 01
    provides: "Shared AskAiPanel, ChatMessage, MemoizedMarkdown, conversation CRUD API"
  - phase: 03-ai-pipeline
    provides: "getAIModel() for AI model access"
  - phase: 01-project-setup
    provides: "Database schema with ai_conversations, ai_conversation_messages, article_file_links, article_db_tables"
provides:
  - "Page-level Ask AI endpoint with rich article context assembly"
  - "Context indicator component showing assembled context items"
  - "Ask AI trigger button on every article page"
  - "Page-level conversations persisted separately per article per user"
affects: [07-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["buildArticleContext assembles article + tech view + files + tables with truncation safety", "X-Context-Info response header for client-side context display", "Context indicator as prop to shared AskAiPanel"]

key-files:
  created:
    - src/app/api/chat/article/route.ts
    - src/components/chat/context-indicator.tsx
    - src/components/chat/ask-ai-page-trigger.tsx
  modified:
    - src/app/(wiki)/wiki/[articleSlug]/page.tsx

key-decisions:
  - "Context info passed via props from article page (not fetched separately) -- avoids extra API call"
  - "X-Context-Info response header carries context metadata to client for display"
  - "Context truncation at 32000 chars with 70/30 split between content and technical view"

patterns-established:
  - "Article context assembly pattern: parallel fetch of article + file links + DB tables"
  - "ContextIndicator as reusable component showing what AI context was used"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 7 Plan 2: Page-level Ask AI Summary

**Page-level Ask AI with article content, technical view, source files, and DB tables as context via buildArticleContext, with context indicator showing assembled items**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T16:19:05Z
- **Completed:** 2026-02-14T16:21:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Streaming AI chat scoped to individual articles with rich context assembly
- Context includes article content, technical view, file links with AI summaries, and DB tables
- Context indicator displays what was used (e.g., "Article content, Technical view, 5 source files, 3 DB tables")
- Truncation safety at 32000 chars prevents context overflow
- Page-level conversations persisted separately from global conversations

## Task Commits

Each task was committed atomically:

1. **Task 1: Page-level chat API route with article context assembly** - `bc342ba` (feat)
2. **Task 2: Context indicator, page trigger, and article page integration** - `e07a0f1` (feat)

## Files Created/Modified
- `src/app/api/chat/article/route.ts` - POST streaming endpoint with buildArticleContext assembling article + tech view + files + tables
- `src/components/chat/context-indicator.tsx` - Compact info bar showing which context items were included
- `src/components/chat/ask-ai-page-trigger.tsx` - Button + panel trigger for page-scoped Ask AI
- `src/app/(wiki)/wiki/[articleSlug]/page.tsx` - Added AskAiPageTrigger with file/table counts from parallel fetch

## Decisions Made
- Context info passed as props from the server-rendered article page rather than fetched via a separate API call. The article page already has access to file links and DB tables, so counts are computed server-side and passed down.
- X-Context-Info response header carries the full context metadata as JSON, allowing the client to display what the AI received.
- Context truncation budget splits 70/30 between article content and technical view when exceeding 32000 characters.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Uses existing OpenRouter API key from admin settings.

## Next Phase Readiness
- Page-level Ask AI fully functional alongside global Ask AI
- Shared AskAiPanel component proven to work with both global and page-level endpoints
- All three Plan 07 plans now complete (01: Global, 02: Page-level, 03: Notifications)

## Self-Check: PASSED

All 3 created files verified present on disk. Both task commits (bc342ba, e07a0f1) verified in git log.

---
*Phase: 07-ask-ai-notifications*
*Completed: 2026-02-14*
