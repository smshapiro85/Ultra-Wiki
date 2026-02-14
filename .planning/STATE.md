# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions
**Current focus:** Phase 8 (AI Prompt Refinement). Plans 1, 2, 4 of 4 complete. Plan 3 remaining.

## Current Position

Phase: 8 of 8 (AI Prompt Refinement)
Plan: 4 of 4 in current phase (3 complete, plan 3 still pending)
Status: Executing Phase 8 plans. 08-01 (prompt hardening), 08-02 (heading sizes), 08-04 (sync page improvements) complete. 08-03 pending.
Last activity: 2026-02-14 -- Completed 08-04-PLAN.md (Sync Page Improvements)

Progress: [████████████████████] 100% (phases 1-7) + Phase 8: 3/4 plans complete

## Performance Metrics

**Velocity:**
- Total plans completed: 31
- Average duration: 3min
- Total execution time: 1.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 15min | 5min |
| 02 | 3 | 11min | 4min |
| 03 | 4 | 13min | 3min |
| 04 | 5 | 14min | 3min |
| 05 | 8 | 23min | 3min |
| 06 | 3 | 11min | 4min |
| 07 | 3 | 12min | 4min |
| 08 | 2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 3min, 4min, 6min, 2min, 1min
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
- [Decision]: AI review annotations after merge (Phase 5). LLM reviews merged content for semantic issues (contradictions, stale info). Never modifies content — creates annotations in `ai_review_annotations` table referencing section headings. Rendered as collapsible banner + section highlights (Option A). Dismissible by any user.
- [Decision]: Admin Review Queue (Phase 5 gap closure). Centralized page listing all articles with merge conflicts (needsReview) + active AI annotations. Filter by category, search by title, sort by date. Links to article for resolution.
- [Decision]: Drafts as version records (Phase 5 gap closure). Replace localStorage auto-save with `changeSource: "draft"` version records (one per user per article, upsert). Drafts visible in history with distinct styling, previewable before continuing.
- [Decision]: Version preview slide-out (Phase 5 gap closure). Click any version history record to view rendered formatted text in a slide-out panel — no restore required.
- [Decision]: Separate "summary model" for short AI outputs (Phase 6 gap closure). New `openrouter_summary_model` setting + `file_summary_prompt`. `github_files.aiSummary` column stores 1-2 sentence file descriptions. Generated during sync on new/changed files. Displayed on Technical View file cards. Summary model reusable for other short-summary needs.
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
- [05-04]: Review triggered inside resolveConflict without versionId -- simpler approach, articleId sufficient for annotation queries
- [05-04]: Server-side annotation count as initialCount prop avoids loading flash on banner
- [05-04]: Inline CSS via style tag for annotation-highlight class (self-contained in component)
- [05-04]: Dynamic import for review module in conflict.ts matching existing pipeline pattern
- [05-01]: EditorLoader client wrapper for ssr:false dynamic import -- Next.js 16 disallows ssr:false in server components
- [05-03]: Client-side diff computation via diffLines -- contentMarkdown sent with versions, diffs computed in browser
- [05-03]: Selection-based UX for version compare/restore -- click cards to toggle, contextual action buttons
- [05-03]: Typed enum cast for Drizzle inArray on changeSource PgEnum column
- ~~[05-01]: Draft auto-save to localStorage on every BlockNote onChange event~~ -- REPLACED: 05-06 replaced with server-side draft version records
- [05-01]: Optimistic locking via ISO timestamp comparison prevents stale saves (409 response)
- [Phase 05]: uploadFile defined inline in ArticleEditor (self-contained) rather than passed as prop from parent
- [06-01]: API route approach for code viewing -- shiki highlights server-side, returns HTML, avoids shipping shiki to client bundle
- [06-01]: saveMode prop on editor for dual-purpose editing (article vs technical view) -- reuses existing BlockNote editor
- [06-01]: Technical view saves create version records preserving current article contentMarkdown alongside change
- [06-02]: CSS classNames approach for react-mentions-ts styling -- integrates with CSS variables for dark mode
- [06-02]: Single-level reply threading enforced in UI while schema supports deeper nesting
- [06-02]: Mention markup (@[display](id)) converted to bold (**@display**) for rendering, raw markup preserved in storage
- [05-05]: Server page + client list pattern for admin review queue -- server fetches all data, client handles search/filter/sort
- [05-06]: Drafts as version records with changeSource "draft" -- upsert pattern (one per user per article), 3s debounced auto-save
- [05-06]: Draft cleanup on successful save via DELETE call (non-blocking, failure acceptable)
- [05-07]: MarkdownHooks (not MarkdownAsync) for client component markdown rendering -- react-markdown v10 has no sync Markdown export
- [05-07]: ChangeSourceBadge extracted to shared file to avoid circular imports between version-history and version-preview
- [05-08]: Text column for themePreference (not enum) -- three values (system/light/dark) don't warrant Postgres enum, avoids migration complexity
- [05-08]: useTheme for immediate client-side switching + server action for DB persistence -- dual strategy for responsiveness
- [Phase 08]: New phase for AI prompt refinement -- category strategy (deterministic rules for reuse vs. creation) and article formatting (no title duplication, H1 as top-level section headings, reduced prose heading CSS sizes)
- [06-03]: Summary model reuses same OpenRouter API key as primary model -- no separate key needed
- [06-03]: File summary generation is non-blocking -- failures do not abort sync or article processing
- [06-03]: AI summaries capped at 500 chars to prevent runaway outputs
- [06-03]: Dynamic imports for getSummaryModel and buildFileSummaryPrompt in pipeline (build-time safety)
- [07-01]: useChat v6 uses messages prop (not initialMessages) + setMessages for conversation switching
- [07-01]: Conversation created before first message (POST /api/conversations then sendMessage) for cleaner flow
- [07-01]: @ai-sdk/react installed separately (not bundled with ai package in v6)
- [07-01]: conversationIdRef pattern to pass latest ID to prepareSendMessagesRequest transport closure
- [07-03]: No new npm dependencies for Slack/SendGrid -- raw fetch() against REST APIs (one POST call each)
- [07-03]: Dynamic import() for notification service in pipeline.ts and conflict.ts (matches existing pattern)
- [07-03]: Notification triggers are fire-and-forget via Promise.catch() -- never block primary actions
- [07-02]: Context info passed as props from server-rendered article page (not fetched separately) -- avoids extra API call
- [07-02]: Context truncation at 32000 chars with 70/30 split between article content and technical view
- [08-01]: 6 explicit category rules in DEFAULT_ANALYSIS_PROMPT (reuse, folder mapping, naming, hierarchy, generic parents, stability)
- [08-01]: H1 for top-level article sections, enforced no-title-duplication in both style prompt and generation prompt
- [08-01]: Dual-location prompt reinforcement -- critical rules stated in both DEFAULT_ARTICLE_STYLE_PROMPT and buildGenerationPrompt for full coverage
- [08-02]: Prose H1 reduced to 1.5em (from 2.25em), H2 to 1.25em, H3 to 1.1em -- all subordinate to article title (text-3xl = 1.875rem)
- [08-02]: Side menu heights recalculated from formula: font-size * 16px * 1.75 line-height + 6px padding
- [08-04]: SSE endpoint at /api/sync/stream parallel to existing server action -- SyncTrigger uses EventSource, cron/API callers unaffected
- [08-04]: expandKey + key prop re-mount pattern for expand/collapse all tree controls (simpler than imperative state management)
- [08-04]: originalNodeMap via useMemo for correct all-children folder selection during filtered search

### Pending Todos

None yet.

### Blockers/Concerns

- ~~[Research]: BlockNote Markdown round-trip is lossy by design~~ -- RESOLVED: pipeline stores markdown only, BlockNote JSON conversion deferred to editor (client-side). No server-side round-trip.
- ~~[Research]: pgboss requires direct (unpooled) Neon connection~~ -- RESOLVED: replaced pgboss with cron-triggered API route (sync is a weekly job, not a persistent queue)
- [Research]: AI merge quality is the highest-risk feature -- no competitor does this well, needs extensive testing in Phase 3

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 08-04-PLAN.md (Sync Page Improvements). Plans 08-01, 08-02, 08-04 complete. 08-03 remaining.
Resume file: .planning/phases/08-ai-prompt-refinement/08-04-SUMMARY.md
