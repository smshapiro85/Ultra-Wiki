---
phase: 03-ai-processing-pipeline
plan: 01
subsystem: ai
tags: [openrouter, vercel-ai-sdk, zod, structured-output, llm, octokit]

# Dependency graph
requires:
  - phase: 02-admin-settings-and-github-sync
    provides: "site_settings (API keys, model config), GitHub client (Octokit), sync metadata (github_files)"
provides:
  - "OpenRouter AI model factory (getAIModel)"
  - "Zod schemas for structured AI analysis output (analysisResponseSchema)"
  - "Prompt builders for analysis and article generation"
  - "File content fetching from GitHub (fetchFileContents)"
  - "AI code analysis returning article plans (analyzeChanges)"
  - "Article content generation from plans (generateArticle)"
  - "Database context queries (getFullCategoryTree, getArticleIndex)"
  - "Shared retry utility (withRetry) extracted to src/lib/github/retry.ts"
affects: [03-02, 03-03, pipeline-orchestrator, sync-trigger]

# Tech tracking
tech-stack:
  added: ["ai (Vercel AI SDK v6)", "@openrouter/ai-sdk-provider"]
  patterns: ["Output.object structured output with Zod schema", "batched LLM calls with merge", "concurrency-limited file fetching"]

key-files:
  created:
    - "src/lib/ai/client.ts"
    - "src/lib/ai/schemas.ts"
    - "src/lib/ai/prompts.ts"
    - "src/lib/ai/analyze.ts"
    - "src/lib/ai/generate.ts"
    - "src/lib/github/retry.ts"
  modified:
    - "src/lib/github/sync.ts"
    - "package.json"

key-decisions:
  - "Zod v4 works directly with AI SDK v6 Output.object -- no zodSchema wrapper needed"
  - "Extracted withRetry to shared src/lib/github/retry.ts for reuse across sync and AI pipeline"
  - "z.record in Zod v4 requires two args (keyType, valueType) unlike Zod v3"
  - "generateText with experimental_output property for structured output (not deprecated generateObject)"

patterns-established:
  - "AI model factory: getAIModel() reads config from site_settings on every call (fresh instance)"
  - "Batched LLM calls: split files into groups of 25 or 50K chars, merge deduplicated responses"
  - "File content fetching: concurrency limit of 5, skip >1MB files, retry transient errors"
  - "Prompt context assembly: category tree + article index + style prompt + file contents"

# Metrics
duration: 6min
completed: 2026-02-13
---

# Phase 3 Plan 1: AI Foundation Layer Summary

**OpenRouter AI client, Zod v4 structured output schemas, prompt builders, GitHub file content fetching, and LLM-powered code analysis with batched article generation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-13T21:34:21Z
- **Completed:** 2026-02-13T21:40:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AI client factory reads OpenRouter API key and model from site_settings, creating fresh provider instances
- Zod v4 schemas define the full structured output shape: articles array with slug, title, action, content, technical view, related files/tables, category suggestion, and conflict detection
- Prompt builders assemble analysis context with category tree, article index, style guide, category reuse directive, and file contents
- File content fetching from GitHub with base64 decoding, 1MB size guard, concurrency limit of 5, and transient error retry
- AI analysis sends code to OpenRouter via Vercel AI SDK generateText + Output.object, with automatic batching for large changesets
- Article generation returns content directly if analysis provided it, or makes a second LLM call
- Database context queries (getFullCategoryTree, getArticleIndex) supply prompt context
- Shared retry utility extracted from sync.ts for cross-module reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: AI client, Zod schemas, and prompt builders** - `cbc3a45` (feat)
2. **Task 2: File content fetching and AI analysis + generation** - `27aed1f` (feat)

## Files Created/Modified
- `src/lib/ai/client.ts` - OpenRouter model factory using Vercel AI SDK provider
- `src/lib/ai/schemas.ts` - Zod v4 schemas for structured AI analysis response
- `src/lib/ai/prompts.ts` - Prompt template builders for analysis and generation
- `src/lib/ai/analyze.ts` - File content fetching, DB context queries, AI analysis with batching
- `src/lib/ai/generate.ts` - Article content generation from plan items
- `src/lib/github/retry.ts` - Shared retry utility (extracted from sync.ts)
- `src/lib/github/sync.ts` - Updated to import retry from shared module
- `package.json` - Added ai and @openrouter/ai-sdk-provider dependencies

## Decisions Made
- Zod v4 works directly with AI SDK v6 Output.object -- no zodSchema wrapper needed (tested at runtime)
- Extracted withRetry to shared src/lib/github/retry.ts rather than duplicating (cleaner reuse)
- z.record in Zod v4 requires explicit keyType and valueType args (fixed during type check)
- Used experimental_output property on generateText result (confirmed via AI SDK types)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 z.record API change**
- **Found during:** Task 1 (schema creation)
- **Issue:** `z.record(z.string())` fails in Zod v4 -- requires two arguments (keyType, valueType)
- **Fix:** Changed to `z.record(z.string(), z.string())`
- **Files modified:** src/lib/ai/schemas.ts
- **Verification:** `npx tsc --noEmit` passes, schema.parse() works with sample data
- **Committed in:** cbc3a45 (Task 1 commit)

**2. [Rule 3 - Blocking] Extracted withRetry to shared module**
- **Found during:** Task 2 (analyze.ts needed retry utility)
- **Issue:** withRetry was private in sync.ts, not importable by analyze.ts
- **Fix:** Extracted to src/lib/github/retry.ts, updated sync.ts to import from shared module
- **Files modified:** src/lib/github/retry.ts (new), src/lib/github/sync.ts (modified)
- **Verification:** `npx tsc --noEmit` passes, sync.ts still imports correctly
- **Committed in:** 27aed1f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI foundation layer complete: client, schemas, prompts, analysis, and generation modules all exist
- Ready for Plan 2 (three-way merge) and Plan 3 (pipeline orchestration)
- analyzeChanges() can receive file contents + category context and return structured article plans
- generateArticle() can produce full article content from plan items
- The withRetry utility is now shared and available for any module

## Self-Check: PASSED

All 7 created files verified present. Both task commits (cbc3a45, 27aed1f) verified in git log.

---
*Phase: 03-ai-processing-pipeline*
*Completed: 2026-02-13*
