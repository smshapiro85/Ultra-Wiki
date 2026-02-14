# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions
**Current focus:** Phase 4 complete -- Wiki Viewer done (sidebar, article pages, search, home dashboard, gap closure). Ready for Phase 5.

## Current Position

Phase: 4 of 7 (Wiki Viewer) -- COMPLETE
Plan: 5 of 5 in current phase (04-05 complete)
Status: Phase 4 complete -- all 5 plans executed (3 core + 2 gap closure). Ready for Phase 5.
Last activity: 2026-02-14 -- Completed 04-05-PLAN.md (bookmark button gap closure)

Progress: [██████████░] 62%

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 4min
- Total execution time: 0.84 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 15min | 5min |
| 02 | 3 | 11min | 4min |
| 03 | 4 | 13min | 3min |
| 04 | 5 | 14min | 3min |

**Recent Trend:**
- Last 5 plans: 3min, 3min, 4min, 2min, 1min
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
- [Decision]: Admin-only "Regenerate Article" button on article page (Phase 4). Re-fetches linked source files, re-runs generation with current prompt. Respects merge strategy for human-edited articles.
- [Decision]: AI review annotations after merge (Phase 3 logic, Phase 4 UI). LLM reviews merged content for semantic issues (contradictions, stale info). Never modifies content — creates annotations in `ai_review_annotations` table referencing section headings. Rendered as collapsible banner + section highlights (Option A). Dismissible by any user.
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
- [03-04]: Dynamic import() at each call site in pipeline.ts for markdown.ts -- prevents @blocknote/server-util from entering module graph at evaluation time
- [03-UAT]: Deferred BlockNote conversion -- pipeline stores contentMarkdown only (contentJson=null). @blocknote/server-util crashes in RSC/Turbopack even with dynamic imports. Conversion to BlockNote JSON deferred to editor (client-side). When AI re-updates, it merges on markdown and resets contentJson to null.
- [03-UAT]: Category cache -- resolveOrCreateCategory now pushes new categories onto in-memory categoryTree array + uses onConflictDoNothing to handle races
- [03-UAT]: Zod v4 z.record() generates propertyNames in JSON schema, rejected by OpenAI-compatible structured output providers. Changed columns field to z.array(z.object({name, description}))
- [03-UAT]: Both AI calls (analyze + generate) now use structured output via Output.object() with Zod schemas
- [03-UAT]: temperature: 0.2 for both AI calls (low creativity, more consistent)
- [03-UAT]: Reasoning effort configurable via admin settings dropdown (none/minimal/low/medium/high/xhigh), passed as reasoning.effort to OpenRouter
- [04-01]: @plugin syntax for @tailwindcss/typography in Tailwind v4 CSS-first config
- [04-01]: CategoryTree as client component (interactive Collapsible state), layout remains server component
- ~~[04-01]: Categories use href="#" in breadcrumbs (no standalone category pages)~~ -- RESOLVED: 04-04 added /wiki/category/[slug] pages
- [04-01]: SidebarProvider + AppSidebar + SidebarInset layout pattern for all wiki pages
- [04-02]: MarkdownAsync named export from react-markdown v10 for async rehype plugin support in RSC
- [04-02]: Shared slugify function between TOC extraction and heading ID generation ensures anchor links match
- [04-02]: Dynamic imports for all AI/merge modules in regenerateArticle to avoid BlockNote createContext crash
- [04-02]: useTransition + sonner toast pattern for server action loading/feedback in client components
- [04-03]: SearchInput uses useDebouncedCallback with URL param navigation (router.push) for shareable search URLs
- [04-03]: Headline sanitization: strip all HTML except <mark> tags via regex for XSS prevention in search results
- [04-03]: user_bookmarks uses composite PK (userId, articleId) -- no separate id column needed for junction table
- [04-03]: actions.ts created fresh with toggleBookmark; Plan 02's regenerateArticle will be added to same file
- [04-04]: getCategoryBySlug uses three separate queries (category, articles, subcategories) for clarity over joins
- [04-04]: Breadcrumb segments always use asChild + Link for client-side navigation (matching Home link pattern)
- [04-05]: BookmarkButton visible to all users; toggleBookmark server action handles auth enforcement
- [04-05]: Optimistic state flip before server call with revert on error for instant feedback

### Pending Todos

None yet.

### Blockers/Concerns

- ~~[Research]: BlockNote Markdown round-trip is lossy by design~~ -- RESOLVED: pipeline stores markdown only, BlockNote JSON conversion deferred to editor (client-side). No server-side round-trip.
- ~~[Research]: pgboss requires direct (unpooled) Neon connection~~ -- RESOLVED: replaced pgboss with cron-triggered API route (sync is a weekly job, not a persistent queue)
- [Research]: AI merge quality is the highest-risk feature -- no competitor does this well, needs extensive testing in Phase 3

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 04-04-PLAN.md -- Breadcrumb links and category page gap closure.
Resume file: .planning/phases/04-wiki-viewer/04-04-SUMMARY.md
