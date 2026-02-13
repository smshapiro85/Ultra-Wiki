# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions
**Current focus:** Phase 3 complete -- AI Processing Pipeline finished. Ready for Phase 4 (Article Editor).

## Current Position

Phase: 3 of 7 (AI Processing Pipeline) -- COMPLETE
Plan: 3 of 3 in current phase (all complete)
Status: Phase 3 complete -- ready for Phase 4
Last activity: 2026-02-13 -- Completed 03-03-PLAN.md (pipeline orchestrator & sync integration)

Progress: [██████░░░░] 43%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 4min
- Total execution time: 0.62 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 15min | 5min |
| 02 | 3 | 11min | 4min |
| 03 | 3 | 12min | 4min |

**Recent Trend:**
- Last 5 plans: 4min, 4min, 3min, 5min, 4min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 7 phases derived from 12 requirement categories, consolidating research's 10 phases to fit standard depth
- [Roadmap]: Phase 3 (AI Pipeline) kept standalone due to complexity and risk -- this is the core differentiator
- [Roadmap]: Technical View + Comments combined into one phase (both are article tab sub-features)
- [Roadmap]: Ask AI + Notifications combined (both are interaction layers depending on all prior phases)
- [01-01]: All 18 tables defined upfront in single schema.ts for clean initial migration
- [01-01]: contentJson (jsonb) added to articles/articleVersions now (nullable) to avoid Phase 5 migration
- [01-01]: isSecret boolean defers encryption to Phase 2; marks fields for UI masking
- [01-01]: node:22-alpine Docker base
- [Decision]: BlockNote JSON as native storage format -- no Markdown round-trip, no Milkdown fallback needed
- [Decision]: Replaced pgboss with cron-triggered API route -- weekly sync doesn't need a persistent job queue
- [Decision]: AI must receive full category tree + article index during generation -- always prefer existing categories over creating new ones. Wiki organization is a first-class concern.
- [Decision]: New repo files/folders surface in a dedicated "New Files Review" admin section (not auto-included). Admin includes or ignores each, then "Apply Updates" triggers AI import + re-index.
- [01-02]: Lazy NextAuth initialization (factory function) to defer DrizzleAdapter creation until request time
- [01-02]: Lazy db client via Proxy + getDb() for build-time safety without DATABASE_URL
- [01-02]: Admin pages at (admin)/admin/users/ path for /admin/users URL with route group layout
- [01-02]: Server action pattern for signIn/signOut instead of client-side auth calls
- [01-03]: Zod v4 import via zod/v4 namespace for server action validation
- [01-03]: useActionState (React 19) for form state management in profile forms
- [01-03]: Client-side signOut in UserMenu via next-auth/react instead of server action
- [01-03]: Sonner toast added to root layout for global form feedback
- [02-01]: cron-parser v5 API (CronExpressionParser.parse) for server-side cron validation
- [02-01]: cronstrue for client-side human-readable cron previews
- [02-01]: github_branch added as 13th setting key (default "main")
- [02-01]: Secret masking pattern: MASK_VALUE skip-save prevents overwriting real secrets
- [02-02]: excludedPaths table repurposed as included-paths storage (pattern column = INCLUDE, not exclude)
- [02-02]: Sync stores metadata only (path, SHA) -- file content deferred to Phase 3
- [02-02]: Retry [1s, 4s, 16s] for transient errors; 401/404 fail immediately
- [02-02]: Atomic sync lock via INSERT NOT EXISTS on sync_logs (Neon HTTP compatible)
- [02-03]: Bearer token auth (CRON_SECRET env var) for machine-to-machine cron endpoint
- [02-03]: Schedule checking: cron-parser prev() vs last completed sync's completedAt
- [02-03]: Invalid cron expressions treated as "not configured" (graceful degradation)
- [03-01]: Zod v4 works directly with AI SDK v6 Output.object -- no zodSchema wrapper needed
- [03-01]: Extracted withRetry to shared src/lib/github/retry.ts for reuse across sync and AI pipeline
- [03-01]: z.record in Zod v4 requires two args (keyType, valueType) unlike Zod v3
- [03-01]: generateText with experimental_output property for structured output (not deprecated generateObject)
- [03-02]: Conflict markers never stored in article content -- human version kept on conflict, AI proposal stored in version history
- [03-02]: node-diff3 merge() conflict counting via startsWith('<<<<<<<') marker detection
- [03-02]: ServerBlockNoteEditor as lazy singleton (synchronous create, reused across requests)
- [03-03]: Dynamic import for AI pipeline in sync.ts -- avoids BlockNote/JSDOM createContext build-time error
- [03-03]: Delete-and-reinsert pattern for article_file_links/article_db_tables (simpler than diff)
- [03-03]: AI pipeline failure does not abort sync -- errors logged, partial results preserved

### Pending Todos

None yet.

### Blockers/Concerns

- ~~[Research]: BlockNote Markdown round-trip is lossy by design~~ -- RESOLVED: storing BlockNote JSON natively, no round-trip needed
- ~~[Research]: pgboss requires direct (unpooled) Neon connection~~ -- RESOLVED: replaced pgboss with cron-triggered API route (sync is a weekly job, not a persistent queue)
- [Research]: AI merge quality is the highest-risk feature -- no competitor does this well, needs extensive testing in Phase 3

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 03-03-PLAN.md -- Phase 3 complete (pipeline orchestrator & sync integration)
Resume file: .planning/phases/03-ai-processing-pipeline/03-03-SUMMARY.md
