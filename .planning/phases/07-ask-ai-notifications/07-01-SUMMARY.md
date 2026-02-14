---
phase: 07-ask-ai-notifications
plan: 01
subsystem: ai, ui
tags: [ai-sdk, useChat, streaming, markdown, sheet, conversations, openrouter]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: "Database schema with ai_conversations, ai_conversation_messages tables"
  - phase: 03-ai-pipeline
    provides: "getAIModel(), getArticleIndex() for AI model access and context assembly"
provides:
  - "Global Ask AI panel accessible from wiki header on every page"
  - "Streaming chat API route with article index context and message persistence"
  - "Conversation CRUD API (list, create, get-with-messages, delete)"
  - "Shared reusable chat components (AskAiPanel, ChatMessage, MemoizedMarkdown, ConversationList)"
affects: [07-02, 07-03]

# Tech tracking
tech-stack:
  added: [marked, "@types/marked", "@ai-sdk/react"]
  patterns: ["useChat + DefaultChatTransport for streaming chat UI", "marked.lexer memoized markdown blocks", "prepareSendMessagesRequest for custom body", "conversation-first then sendMessage flow"]

key-files:
  created:
    - src/components/chat/memoized-markdown.tsx
    - src/components/chat/chat-message.tsx
    - src/components/chat/ask-ai-panel.tsx
    - src/components/chat/conversation-list.tsx
    - src/components/chat/ask-ai-global-trigger.tsx
    - src/app/api/chat/route.ts
    - src/app/api/conversations/route.ts
    - src/app/api/conversations/[id]/route.ts
  modified:
    - src/app/(wiki)/layout.tsx
    - package.json

key-decisions:
  - "useChat v6 uses messages prop (not initialMessages) + setMessages for conversation switching"
  - "Conversation created before first message (POST /api/conversations then sendMessage) for cleaner flow"
  - "conversationIdRef used to pass current ID to prepareSendMessagesRequest transport closure"
  - "@ai-sdk/react installed separately (not bundled with ai package in v6)"
  - "ConversationList created in Task 1 (moved forward from Task 2) since AskAiPanel imports it"

patterns-established:
  - "Chat panel pattern: Sheet + useChat + DefaultChatTransport for slide-out AI chat"
  - "Message persistence: server loads prior from DB, streams response, persists both on onFinish"
  - "Memoized streaming markdown: marked.lexer block splitting + React.memo per block"

# Metrics
duration: 6min
completed: 2026-02-14
---

# Phase 7 Plan 1: Ask AI Global Panel Summary

**Global Ask AI with streaming markdown responses via useChat + DefaultChatTransport, article index context, and full conversation CRUD persistence**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-14T16:09:14Z
- **Completed:** 2026-02-14T16:16:13Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Streaming AI chat panel accessible from every wiki page via header button
- Article index (titles, slugs, categories) passed as context to AI for wiki-aware responses
- Conversations persisted to DB with full CRUD: create, list, load-with-messages, delete
- Memoized markdown rendering prevents re-render cascade during streaming
- Shared AskAiPanel component reusable for both global and page-level chat (Plan 02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install marked, create shared chat components, and global streaming API route** - `8dcda66` (feat)
2. **Task 2: Conversation CRUD API, conversation list UI, and global trigger in header** - `be27d2e` (feat)

## Files Created/Modified
- `src/components/chat/memoized-markdown.tsx` - Streaming-safe markdown renderer using marked.lexer + React.memo
- `src/components/chat/chat-message.tsx` - Role-styled message component with memoized markdown for assistant
- `src/components/chat/ask-ai-panel.tsx` - Sheet-based chat UI with useChat streaming, conversation management
- `src/components/chat/conversation-list.tsx` - Compact conversation list with select, new, delete
- `src/components/chat/ask-ai-global-trigger.tsx` - Sparkles button that opens the global Ask AI panel
- `src/app/api/chat/route.ts` - POST streaming endpoint with article index context and message persistence
- `src/app/api/conversations/route.ts` - GET list + POST create conversations
- `src/app/api/conversations/[id]/route.ts` - GET with messages + DELETE single conversation
- `src/app/(wiki)/layout.tsx` - Added AskAiGlobalTrigger to header
- `package.json` - Added marked, @types/marked, @ai-sdk/react

## Decisions Made
- **useChat v6 API:** `initialMessages` does not exist in v6. Used `messages` in ChatInit for seeding, `setMessages()` for conversation switching.
- **Conversation-first flow:** Create conversation via POST /api/conversations before first sendMessage, rather than creating inline during stream. Cleaner separation of concerns.
- **conversationIdRef pattern:** Used a ref to pass the latest conversationId to the transport's prepareSendMessagesRequest closure, since state updates are asynchronous.
- **@ai-sdk/react separate install:** Not bundled with `ai` package in v6 -- installed as explicit dependency.
- **ConversationList moved to Task 1:** AskAiPanel imports ConversationList, so it was created in Task 1 to avoid build failures (Rule 3 deviation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ConversationList created in Task 1 instead of Task 2**
- **Found during:** Task 1 (AskAiPanel creation)
- **Issue:** AskAiPanel imports ConversationList, but ConversationList was planned for Task 2. Build would fail without it.
- **Fix:** Created ConversationList in Task 1 alongside the other chat components.
- **Files modified:** src/components/chat/conversation-list.tsx
- **Verification:** TypeScript compilation succeeds, build passes
- **Committed in:** 8dcda66 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed useChat v6 API: no initialMessages prop**
- **Found during:** Task 1 (AskAiPanel creation)
- **Issue:** Plan referenced `initialMessages` prop which does not exist in useChat v6. TypeScript error TS2353.
- **Fix:** Used `messages` from ChatInit for initial seed, `setMessages()` for runtime conversation switching, and removed the non-existent `key` prop.
- **Files modified:** src/components/chat/ask-ai-panel.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 8dcda66 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
- Next.js build had transient ENOENT errors on `.next/` cache files (unrelated to code changes). Resolved by cleaning `.next/` directory and rebuilding.

## User Setup Required
None - no external service configuration required. Uses existing OpenRouter API key from admin settings.

## Next Phase Readiness
- Shared chat components (AskAiPanel, ChatMessage, MemoizedMarkdown) ready for reuse in Plan 02 (page-level Ask AI)
- Conversation CRUD API supports both global and page modes via `mode` parameter
- Article index context pattern established; page-level will use article-specific context instead

## Self-Check: PASSED

All 8 created files verified present on disk. Both task commits (8dcda66, be27d2e) verified in git log.

---
*Phase: 07-ask-ai-notifications*
*Completed: 2026-02-14*
