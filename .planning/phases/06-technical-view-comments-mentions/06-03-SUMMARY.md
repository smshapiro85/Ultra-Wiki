---
phase: 06-technical-view-comments-mentions
plan: 03
subsystem: ai, ui
tags: [openrouter, ai-summaries, drizzle, pipeline, technical-view]

# Dependency graph
requires:
  - phase: 06-01
    provides: Technical View tabs, file-link-card component, code viewer dialog
provides:
  - openrouter_summary_model admin setting for a fast/cheap AI model
  - file_summary_prompt admin setting for customizable file description prompts
  - githubFiles.aiSummary column storing per-file AI descriptions
  - getSummaryModel() reusable function for short AI outputs
  - generateFileSummaries() pipeline step for automatic summary generation
  - buildFileSummaryPrompt() prompt builder for file summaries
  - Technical View file cards displaying AI summaries
affects: [07-ask-ai-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-import-pipeline, non-blocking-supplementary-step, per-file-error-isolation]

key-files:
  created: []
  modified:
    - src/lib/settings/constants.ts
    - src/lib/db/schema.ts
    - src/lib/db/seed.ts
    - src/lib/ai/client.ts
    - src/lib/ai/pipeline.ts
    - src/lib/ai/prompts.ts
    - src/lib/wiki/queries.ts
    - src/app/(admin)/admin/settings/actions.ts
    - src/app/(admin)/admin/settings/api-keys-settings.tsx
    - src/app/(admin)/admin/settings/ai-prompts-settings.tsx
    - src/components/wiki/file-link-card.tsx
    - src/components/wiki/technical-view.tsx

key-decisions:
  - "Summary model uses same API key as primary model but separate model name"
  - "File summary generation is non-blocking -- failures do not abort sync"
  - "AI summary capped at 500 chars to prevent runaway outputs"
  - "Dynamic imports in pipeline for getSummaryModel and buildFileSummaryPrompt"

patterns-established:
  - "Non-blocking supplementary step: try/catch wrapper around optional pipeline steps"
  - "Per-file error isolation: individual file failures logged but do not block remaining files"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 6 Plan 3: AI File Summaries Summary

**Separate summary model setting with automatic per-file AI descriptions during sync, displayed on Technical View file cards**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T06:31:49Z
- **Completed:** 2026-02-14T06:34:59Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Admin can configure a separate summary model and file summary prompt in settings
- During sync, new/changed files automatically get 1-2 sentence AI summaries via the summary model
- Technical View file cards display AI summaries above relevance explanations
- getSummaryModel() is reusable for any future short-output AI needs
- Summary generation gracefully degrades (skipped if model not configured, per-file errors isolated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Summary model settings, schema column, AI client, and seed** - `85aec88` (feat)
2. **Task 2: Pipeline integration and Technical View UI update** - `7935264` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/lib/settings/constants.ts` - Added openrouter_summary_model and file_summary_prompt setting keys
- `src/lib/db/schema.ts` - Added aiSummary text column to githubFiles table
- `src/lib/db/seed.ts` - Added seed entries for new settings
- `src/lib/ai/client.ts` - Added getSummaryModel() for short AI outputs
- `src/lib/ai/pipeline.ts` - Added generateFileSummaries() and wired into runAIPipeline
- `src/lib/ai/prompts.ts` - Added DEFAULT_FILE_SUMMARY_PROMPT and buildFileSummaryPrompt()
- `src/lib/wiki/queries.ts` - Updated getArticleFileLinks to return aiSummary
- `src/app/(admin)/admin/settings/actions.ts` - Added save logic for both new settings
- `src/app/(admin)/admin/settings/api-keys-settings.tsx` - Added Summary Model input field
- `src/app/(admin)/admin/settings/ai-prompts-settings.tsx` - Added File Summary Prompt textarea
- `src/components/wiki/file-link-card.tsx` - Added aiSummary prop and rendering
- `src/components/wiki/technical-view.tsx` - Pass aiSummary to FileLinkCard

## Decisions Made
- Summary model reuses the same OpenRouter API key as the primary model (no separate key needed)
- File summary generation is non-blocking -- if the summary model is not configured, it logs a warning and returns silently
- AI summaries capped at 500 characters to prevent runaway model outputs
- Dynamic imports used for getSummaryModel and buildFileSummaryPrompt in pipeline to avoid build-time issues
- Per-file error isolation ensures one failed summary does not block the rest

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Admin can optionally configure the summary model via Settings > API Keys.

## Next Phase Readiness
- Phase 6 is now fully complete (all 3 plans delivered)
- AI file summaries are ready for display and will populate as users run syncs with a configured summary model
- getSummaryModel() available for reuse in Phase 7 (Ask AI / Notifications) or elsewhere

## Self-Check: PASSED

All 12 modified files verified present. Both task commits (85aec88, 7935264) verified in git log.

---
*Phase: 06-technical-view-comments-mentions*
*Completed: 2026-02-14*
