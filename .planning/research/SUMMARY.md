# Project Research Summary

**Project:** Ultra-Wiki (AI-augmented internal wiki)
**Domain:** Code documentation platform with automated code-to-wiki pipeline
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## Executive Summary

Ultra-Wiki is an AI-powered internal documentation system that automatically generates and maintains wiki articles from source code analysis. The recommended approach uses Next.js 15 with Neon Postgres, BlockNote WYSIWYG editor, and OpenRouter for AI processing. The system requires a carefully designed merge strategy to preserve human edits when AI updates articles—this is the core architectural challenge and the product's main differentiator. No competitor successfully combines automated code-to-wiki generation with human editorial control.

The technology stack is sound with two critical corrections needed: (1) pgboss requires a direct Neon connection (unpooled) because it uses LISTEN/NOTIFY, incompatible with PgBouncer transaction pooling, and (2) BlockNote's Markdown round-trip is explicitly lossy, requiring either dual storage (JSON + Markdown) or early validation and potential fallback to Milkdown. The recommended stack favors proven, well-documented technologies over bleeding-edge choices, which is appropriate for a complex domain-specific application.

Key risks center on the AI-human merge quality, context window limitations during large code syncs, and editor fidelity. All have documented mitigation strategies. The project is feasible with careful attention to these integration points. Success depends on getting the merge strategy right—if the AI silently destroys human edits, users will lose trust and the product fails.

## Key Findings

### Recommended Stack

The research validates most stack choices with version updates and two architectural corrections. Next.js 15 (not 16) is the production-stable target. Neon Postgres with Drizzle ORM provides the right balance of serverless convenience and raw SQL control for full-text search. BlockNote is the best WYSIWYG editor for React but has known Markdown conversion limitations that must be addressed architecturally.

**Core technologies:**
- **Next.js 15** + React 19 — Stable LTS with Turbopack and App Router maturity; Next.js 16 is too new
- **Neon Postgres** with dual connections — HTTP driver (@neondatabase/serverless) for app queries, direct TCP for pgboss
- **Drizzle ORM 0.45.x** — Lightweight, SQL-like API with excellent Postgres full-text search support
- **BlockNote 0.46.x** — Best Notion-style block editor for React, but requires Markdown fidelity testing early
- **Vercel AI SDK 6.x** + OpenRouter provider — Unified AI interface with streaming, structured output, and React hooks
- **pgboss 12.x** — Postgres-native job queue (zero additional infrastructure), must use direct connection
- **NextAuth v5 (beta)** — Only auth solution compatible with Next.js 15 App Router despite "beta" label
- **shadcn/ui** + Tailwind CSS 4 — Component library with Radix UI primitives, CLI-based installation

**Critical gotcha:** pgboss + Neon pooled connections = silent failure. pgboss uses LISTEN/NOTIFY which is incompatible with PgBouncer transaction mode. Must use DATABASE_URL_UNPOOLED for the pgboss instance.

### Expected Features

Research identifies a clear feature hierarchy. The AI-human merge strategy is the core differentiator—no competitor does this well. Auto-generated table of contents is a glaring omission from the spec (every modern wiki has this). Content staleness detection and article ownership complement the AI auto-update by handling non-code-linked content.

**Must have (table stakes):**
- Markdown rendering with GFM, syntax highlighting, and TOC
- Full-text search with highlighting (Postgres tsvector sufficient)
- WYSIWYG editor with image paste/upload
- Version history with side-by-side diff and rollback
- SSO authentication (Google OIDC) with role-based access
- Category navigation with sidebar tree and breadcrumbs
- Threaded comments with @mentions and notifications
- Admin settings dashboard with secret masking

**Should have (competitive advantage):**
- Auto-generate articles from source code analysis (core differentiator)
- AI + human merge strategy with conflict detection (unique to Ultra-Wiki)
- Technical view showing file and DB table mappings
- Page-level Ask AI with source code context (richer than competitors)
- Admin-editable AI prompts (transparency and control)
- Scheduled + manual code sync with retry logic

**Missing from spec (add to roadmap):**
- Auto-generated table of contents (HIGH impact, LOW complexity—trivial to build)
- Article bookmarks/favorites (HIGH impact, LOW complexity)
- Content staleness detection with review reminders (MEDIUM impact, complements AI)
- Article ownership (LOW complexity, needed for accountability)
- Semantic search with pgvector (MEDIUM impact, defer to v1.x after MVP validation)

**Defer to v2+:**
- Article templates for manual content creation
- Recently viewed / activity feed
- Backlinks and related articles
- PDF/Markdown export
- Usage analytics dashboard

### Architecture Approach

The architecture centers on a single Docker container running Next.js with an in-process pgboss worker, talking to remote Neon Postgres and external APIs (OpenRouter, GitHub, Slack, SendGrid). The dual database connection strategy (HTTP driver for app, direct TCP for pgboss) is the most important architectural decision. The AI merge is a three-phase process: compute human diff, compute AI diff, send both to AI for intelligent merge with conflict detection.

**Major components:**

1. **Next.js App Router** — Three route groups (auth, wiki, admin) with separate layout shells; RSC for rendering, API routes for streaming AI, Server Actions for mutations
2. **Service Layer** — Business logic in `lib/services/`: sync orchestration, AI pipeline, merge strategy, notifications; pure TypeScript, no framework coupling
3. **Data Access Layer** — Drizzle ORM queries in `lib/db/queries/`, typed schema definitions, custom tsvector type for full-text search
4. **pgboss Worker** — Started via `instrumentation.ts` on server init, processes background jobs (sync, AI generation, notifications) in-process
5. **Dual DB Connections** — Neon HTTP driver (fast, stateless) for route handlers and RSC; direct Postgres driver (persistent) for pgboss
6. **AI Pipeline** — OpenRouter via Vercel AI SDK; `streamText()` for interactive chat, `generateObject()` with Zod schemas for background article generation
7. **Merge Service** — Three-way merge (previous AI version, current with human edits, new AI content); uses `diff` library to detect conflicts, sends to AI for resolution
8. **Image Processing** — sharp for resize/compress, local filesystem at `/data/images` (Docker volume), API route for upload/serve

**Key pattern:** The merge strategy is the most architecturally complex feature. It requires storing the "last AI version" in `article_versions`, computing structural diffs, and using AI to merge intelligently while flagging conflicts. The quality depends on AI instruction-following ability and needs extensive testing.

### Critical Pitfalls

Research identifies five critical pitfalls that will cause project failure if not addressed:

1. **BlockNote Markdown round-trip is lossy by design** — BlockNote's export is explicitly called `blocksToMarkdownLossy()`. Nested blocks flatten, some styles strip, tables have known bugs. Repeated edit cycles degrade content. **Solution:** Store BlockNote JSON alongside Markdown (dual storage) OR validate fidelity early and switch to Milkdown if unacceptable. Phase 1 schema decision, Phase 5 validation.

2. **pgboss connection termination on Neon auto-suspend** — Neon suspends idle computes after 5 minutes (free tier). This severs TCP connections, crashing pgboss. Sync jobs silently stop. **Solution:** Disable Neon auto-suspend in production, enable TCP keep-alive on pgboss connection, implement error handler with restart logic, use direct (unpooled) connection. Phase 2 (pgboss setup).

3. **AI merge silently destroys human edits** — LLMs optimize for coherent output, not preservation of exact text. The AI may drop human sections, rephrase into AI-style prose, miss conflicts, or hallucinate conflicts. **Solution:** Implement deterministic section-level merge BEFORE AI involvement, use structural markers to protect human-edited sections, always diff pre/post merge and flag deletions for review, never let AI be sole arbiter. Phase 3 (merge logic).

4. **AI returns malformed or schema-violating JSON** — Large structured JSON with embedded Markdown frequently produces trailing commas, unescaped characters, missing brackets, truncated output, or valid JSON that doesn't match the schema. **Solution:** Enable OpenRouter Response Healing, use structured output with json_schema, implement robust parsing with fallback (json-repair library), validate with Zod, process articles one at a time for large changesets. Phase 3 (AI pipeline).

5. **Large codebase exceeds AI context window** — A 500-file changeset blows past any context window. Even 200K token models suffer "lost in the middle" at 32K+ tokens—information buried gets ignored. **Solution:** Implement file-group batching by directory/module, use two-pass analysis (identify affected articles, then analyze each with only relevant files), track file-to-article mappings to reduce context size, set hard token budget with tiktoken counting. Phase 3 (AI pipeline).

## Implications for Roadmap

Based on research, the roadmap should follow a **data-first, then display, then editing** progression. The AI pipeline must produce articles before the wiki has content to display. The merge strategy is complex enough to warrant its own phase. Each phase should address specific pitfalls identified in research.

### Phase 1: Foundation & Database Schema
**Rationale:** Everything depends on the database schema. The BlockNote dual-storage decision (JSON + Markdown) must be made now, not retrofitted later. Auth is foundational for all features.

**Delivers:** Database schema with Drizzle migrations, NextAuth v5 with Google OIDC, Docker Compose setup with volume mounts for images, basic layout shell

**Critical decision:** Add `content_json` column to `articles` table for BlockNote JSON storage alongside `content_markdown`. This avoids the lossy round-trip pitfall.

**Avoids:** Pitfall #1 (BlockNote lossy Markdown) by making the storage decision up-front

**Research needed:** None—standard patterns

---

### Phase 2: Admin Settings & GitHub Sync
**Rationale:** The system needs configuration before it can fetch code. GitHub sync produces the raw material for AI processing. pgboss setup is critical and must be done correctly from the start.

**Delivers:** Admin dashboard with site_settings table (encrypted secrets), GitHub API client with Octokit, pgboss initialization via instrumentation.ts (with health monitoring), GitHub file sync service (fetch, filter, diff, store), manual sync trigger API

**Uses:** Drizzle ORM for settings queries, direct Neon connection for pgboss, Octokit for GitHub API

**Implements:** Service layer pattern (lib/services/sync.ts), pgboss worker pattern

**Avoids:** Pitfall #2 (pgboss connection termination) by using direct connection, TCP keep-alive, error handlers, and globalThis singleton pattern

**Research needed:** None for GitHub API (standard REST), possibly research pgboss integration testing patterns

---

### Phase 3: AI Processing Pipeline & Merge Strategy
**Rationale:** This is the most complex phase and the product's core value. Needs its own focused phase. Merge strategy quality determines product success or failure.

**Delivers:** OpenRouter client via Vercel AI SDK, AI article generation with structured JSON parsing and validation, three-way merge service with conflict detection, AI prompt editors in admin UI, background job handlers for sync → AI → merge flow

**Uses:** Vercel AI SDK with OpenRouter provider, Zod for schema validation, diff library for content comparison, pgboss for job orchestration

**Implements:** AI pipeline architecture, merge strategy pattern, batching for context window management

**Avoids:**
- Pitfall #3 (merge destroys edits) via deterministic section-level merge, structural markers, automatic diff review
- Pitfall #4 (malformed JSON) via Response Healing, structured output, robust parsing, Zod validation
- Pitfall #5 (context window overflow) via file-group batching, token counting, two-pass analysis

**Research needed:** HIGH—this is the most complex domain-specific logic. May need `/gsd:research-phase` for merge algorithm design, batching strategies, and prompt engineering best practices.

---

### Phase 4: Wiki Content Display
**Rationale:** By now the AI pipeline has generated articles. Time to build the user-facing wiki viewer. This phase is mostly standard wiki patterns.

**Delivers:** Article view with Markdown rendering (react-markdown + rehype plugins), auto-generated table of contents with active section highlighting, category navigation with sidebar tree and breadcrumbs, full-text search with Postgres tsvector and result highlighting, home/dashboard page with recent updates and bookmarks

**Uses:** react-markdown with remark-gfm and rehype-highlight, Postgres tsvector with GIN index, shadcn/ui components

**Implements:** Wiki viewer component architecture, search service with tsvector queries

**Avoids:** Search indexing Markdown syntax (strip formatting before to_tsvector)

**Research needed:** None—well-documented patterns for Markdown rendering and Postgres full-text search

---

### Phase 5: Article Editing & Images
**Rationale:** Users need to edit AI-generated content. This is where BlockNote fidelity gets validated. Image handling is straightforward but must integrate with the editor.

**Delivers:** BlockNote editor integration with Markdown round-trip conversion, image paste/upload with sharp processing, image serving API route, localStorage auto-save with navigation guards, version history with diff viewer and rollback

**Uses:** BlockNote 0.46.x, sharp for image processing, diff library for version comparison

**Implements:** Editor abstraction layer (Markdown ↔ BlockNote JSON), image processing service

**Critical validation:** Test BlockNote Markdown fidelity with representative content (tables, nested lists, code blocks, bold+italic combinations). If lossy, switch to Milkdown.

**Avoids:** Pitfall #1 (lossy round-trip) via dual storage or Milkdown fallback, unsaved changes lost via navigation guards

**Research needed:** MEDIUM—may need `/gsd:research-phase` if BlockNote fidelity is unacceptable and Milkdown integration research required

---

### Phase 6: Technical View & Code Context
**Rationale:** Builds on the AI pipeline (which populates file/table links). Differentiates Ultra-Wiki from competitors by showing code-to-doc mappings.

**Delivers:** Technical view tab showing linked source files and DB tables, GitHub deep links to files and line numbers, editable file/table associations, article metadata sidebar with AI/human badge and staleness indicators

**Uses:** article_file_links and article_db_tables (populated by AI pipeline), Octokit for GitHub URL generation

**Implements:** Technical view component, metadata display patterns

**Research needed:** None—standard UI patterns

---

### Phase 7: Comments & Mentions
**Rationale:** Collaboration features build on the wiki viewer. Needed before notifications (Phase 8) since notifications trigger on comment/mention events.

**Delivers:** Threaded comments with Markdown support, @mention autocomplete, resolve/unresolve workflow, comment count indicators

**Uses:** Drizzle queries for comments and mentions, shadcn/ui components

**Implements:** Comment component hierarchy, mention parsing and user lookup

**Research needed:** None—standard patterns

---

### Phase 8: Notifications & Alerts
**Rationale:** Depends on comments/mentions (Phase 7) and sync events (Phase 2-3). Completes the collaboration loop.

**Delivers:** Slack DM integration via @slack/web-api, SendGrid email integration, notification preferences per user, notification triggers (sync complete, AI updates, mentions, conflicts), pgboss job queue for async delivery

**Uses:** @slack/web-api, @sendgrid/mail, pgboss for async job processing

**Implements:** Notification dispatcher service, multi-channel delivery pattern

**Research needed:** None—standard API integrations

---

### Phase 9: Ask AI (Global & Page-Level)
**Rationale:** Builds on the AI pipeline (Phase 3) and article content (Phase 4+). Page-level Ask AI requires technical view context (Phase 6).

**Delivers:** Global Ask AI chat panel with conversation history, page-level Ask AI with article + source files + DB schemas as context, streaming responses via useChat() hook, conversation persistence

**Uses:** Vercel AI SDK streamText(), OpenRouter provider, useChat() React hook

**Implements:** AI streaming architecture, context assembly service for page-level queries

**Research needed:** None—Vercel AI SDK has extensive documentation for Next.js streaming

---

### Phase 10: Polish & Production Readiness
**Rationale:** Final hardening before launch. Addresses UX gaps, security hardening, monitoring, and deployment documentation.

**Delivers:** Keyboard shortcuts (Cmd+K for search), article bookmarks/favorites, recently viewed list, content staleness detection with review reminders, article ownership, secrets encryption in site_settings, sync status monitoring, Docker deployment documentation

**Uses:** Existing infrastructure, adds polish features

**Implements:** Monitoring patterns, security hardening, UX improvements

**Research needed:** None—standard production practices

---

### Phase Ordering Rationale

The research clearly shows a **dependency chain**: Database schema → GitHub sync → AI pipeline → Wiki display → Editing → Collaboration features. This is the only viable order because:

1. **Schema decisions (Phase 1) affect all downstream work** — The BlockNote JSON storage decision cannot be changed later without a painful migration
2. **AI pipeline (Phase 3) must work before wiki has content (Phase 4)** — No point building a wiki viewer with no articles to show
3. **Merge strategy (Phase 3) is the highest-risk feature** — Needs focused attention in its own phase with extensive testing
4. **Editing (Phase 5) depends on content existing (Phase 4)** — Must validate BlockNote fidelity with real AI-generated articles, not dummy content
5. **Notifications (Phase 8) depend on comment/mention events (Phase 7)** — Build the events before the notification triggers
6. **Ask AI (Phase 9) needs article context from multiple phases** — Technical view (Phase 6), version history (Phase 5), and content display (Phase 4) all contribute context

The grouping avoids **context switching**: each phase focuses on a specific subsystem (admin, AI, display, editing, collaboration). This also aligns with testing strategy—each phase produces a testable vertical slice.

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3 (AI Pipeline & Merge):** Complex domain-specific logic. May need `/gsd:research-phase` for:
  - Merge algorithm design and implementation patterns
  - Context window management and batching strategies
  - Prompt engineering best practices for code analysis
  - JSON schema validation and repair techniques

- **Phase 5 (Article Editing):** Conditional research needed only if BlockNote fidelity test fails:
  - Milkdown architecture and React integration
  - Milkdown vs BlockNote migration path
  - Markdown-native editor comparison

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** NextAuth, Drizzle, Docker—all well-documented
- **Phase 2 (GitHub Sync):** Octokit has extensive docs, pgboss patterns are documented
- **Phase 4 (Wiki Display):** react-markdown and Postgres full-text search are mature
- **Phase 6 (Technical View):** Standard UI patterns
- **Phase 7 (Comments):** Standard collaboration patterns
- **Phase 8 (Notifications):** Standard API integrations (Slack, SendGrid)
- **Phase 9 (Ask AI):** Vercel AI SDK has extensive Next.js docs
- **Phase 10 (Polish):** Standard production practices

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Most choices verified against official sources. Next.js 15 is stable, Drizzle and AI SDK are mature. BlockNote Markdown lossy issue is officially documented. Only MEDIUM for pgboss + Neon integration (community sources, needs testing). |
| Features | MEDIUM-HIGH | Table stakes features are well-established (every wiki has them). Competitive analysis identifies Ultra-Wiki's unique positioning. MEDIUM because the AI-human merge quality is unproven—no competitor does this successfully yet. |
| Architecture | MEDIUM-HIGH | Dual connection pattern, pgboss in-process, AI streaming patterns are all documented. MEDIUM because the merge strategy quality depends on AI instruction-following, which needs empirical validation. The architectural approach is sound; execution risk is in the AI merge. |
| Pitfalls | HIGH | All five critical pitfalls verified via official docs, GitHub issues, and multiple sources. Mitigation strategies are documented and actionable. The "lossy Markdown" and "pgboss + Neon" issues are explicitly confirmed by official documentation. |

**Overall confidence:** MEDIUM-HIGH

The technology choices are sound and well-researched. The architectural patterns are proven. The main uncertainty is in the AI merge quality—this is novel functionality with no established patterns to follow. The research provides clear mitigation strategies (deterministic section merge, structural markers, diff review), but the proof will be in Phase 3 implementation.

### Gaps to Address

**During planning:**

1. **AI merge algorithm specifics** — Research provides strategy (three-way merge with conflict detection) but not implementation details. Phase 3 planning may need `/gsd:research-phase` to explore:
   - Section-level vs paragraph-level vs line-level merge granularity
   - Which diff algorithm to use (Myers vs Patience vs Histogram)
   - How to define "section" boundaries in Markdown (by heading only? by block type?)
   - Prompt structure for merge requests to AI

2. **Context window batching strategy** — Research identifies the problem and suggests file-group batching, but needs concrete implementation during Phase 3 planning:
   - How to group files (by directory? by module? by change size?)
   - Batch size calculation (how many tokens per batch?)
   - How to handle cross-module dependencies in batched analysis

3. **BlockNote fidelity threshold** — Needs early spike (Phase 5 start) to determine acceptable vs unacceptable loss:
   - Define representative content samples (tables, nested lists, code blocks, formatting combos)
   - Test round-trip fidelity quantitatively (% content preserved, # of formatting changes)
   - Set acceptance criteria (e.g., "95%+ content preserved, <5 formatting changes per 100 blocks")

**During implementation:**

4. **pgboss + Neon resilience** — Research provides mitigation strategies (disable auto-suspend, TCP keep-alive, error handlers). Needs integration testing (Phase 2):
   - Simulate Neon connection drop and verify recovery
   - Test globalThis singleton pattern prevents multiple instances
   - Validate job queue survives server restart

5. **Version history storage growth** — Research flags this as a performance trap. Needs monitoring (Phase 10):
   - Track article_versions table size over first 3 months
   - Set alert at 1GB
   - Plan compression or retention policy if needed

## Sources

### Primary Sources (HIGH confidence)

**Stack research:**
- [BlockNote official docs](https://www.blocknotejs.org/docs/foundations/supported-formats) — Markdown lossy export confirmed
- [pgboss GitHub](https://github.com/timgit/pg-boss) — Version, Node.js requirements, features
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) — PgBouncer transaction mode, LISTEN/NOTIFY incompatible
- [OpenRouter AI SDK docs](https://openrouter.ai/docs/community/vercel-ai-sdk) — Integration pattern
- [Vercel AI SDK docs](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — Next.js App Router streaming
- [Next.js 15 docs](https://nextjs.org/docs) — App Router, instrumentation, middleware
- [Drizzle ORM Postgres full-text search guide](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) — tsvector pattern
- [Auth.js Drizzle adapter](https://authjs.dev/reference/adapter/drizzle) — Official adapter docs

**Features research:**
- [Guru AI Knowledge Base Guide](https://www.getguru.com/reference/ai-knowledge-base) — Competitor features
- [Document360 Health Check Metrics](https://docs.document360.com/docs/health-check-metrics) — Content staleness patterns
- [Swimm Auto-sync Documentation](https://docs.swimm.io/features/keep-docs-updated-with-auto-sync/) — Code-to-docs competitor
- [DeepWiki-Open GitHub](https://github.com/AsyncFuncAI/deepwiki-open) — Code-to-docs competitor
- [MediaWiki Table of Contents Research](https://www.mediawiki.org/wiki/Reading/Web/Desktop_Improvements/Features/Table_of_contents/en) — User research on TOC

**Architecture research:**
- [Neon connection types docs](https://neon.com/docs/connect/choose-connection) — HTTP vs direct connection
- [pgboss serverless discussion #403](https://github.com/timgit/pg-boss/discussions/403) — noSupervisor mode
- [Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation) — Background worker pattern
- [BlockNote Markdown export docs](https://www.blocknotejs.org/docs/features/export/markdown) — blocksToMarkdownLossy API

**Pitfalls research:**
- [BlockNote format interoperability](https://www.blocknotejs.org/docs/foundations/supported-formats) — Official confirmation of lossy export
- [pgboss Issue #381](https://github.com/timgit/pg-boss/issues/381) — Connection termination reports
- [Neon blog: auto-suspend with long-running apps](https://neon.com/blog/using-neons-auto-suspend-with-long-running-applications) — Official guidance
- [OpenRouter Response Healing docs](https://openrouter.ai/docs/guides/features/plugins/response-healing) — JSON repair feature
- [OpenRouter Structured Outputs docs](https://openrouter.ai/docs/guides/features/structured-outputs) — Schema-constrained responses

### Secondary Sources (MEDIUM confidence)

- [FullScale: Building a Technical Wiki](https://fullscale.io/blog/build-a-technical-wiki-engineers-actually-use/) — Statistics on documentation trust
- [Mintlify Autopilot blog](https://www.mintlify.com/blog/autopilot) — Competitor capabilities
- [Neon pgvector guide](https://neon.com/guides/ai-embeddings-postgres-search) — Semantic search patterns
- [Liveblocks rich text editor comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) — Editor evaluation
- [Next.js singleton discussion #68572](https://github.com/vercel/next.js/discussions/68572) — globalThis pattern

### Tertiary Sources (LOW confidence, needs validation)

- [Whatfix: Internal Wiki Guide](https://whatfix.com/blog/internal-wiki/) — Feature landscape (vendor blog)
- [Document360: Wiki Software Tools](https://document360.com/blog/wiki-software/) — Feature landscape (vendor blog)
- [Kinde: AI Context Windows](https://www.kinde.com/learn/ai-for-software-engineering/best-practice/ai-context-windows-engineering-around-token-limits-in-large-codebases/) — Chunking strategies
- [Wikipedia AI editing experience](https://wikiedu.org/blog/2026/01/29/generative-ai-and-wikipedia-editing-what-we-learned-in-2025/) — AI content lessons
- Community discussions on Next.js SSE, Clerk session management — UX patterns

---

*Research completed: 2026-02-13*
*Ready for roadmap: YES*
