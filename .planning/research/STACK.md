# Stack Research

**Domain:** AI-augmented internal wiki (self-hosted, single-tenant)
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH (most choices verified against current sources; some versions in flux)

## Verdict on the Spec's Stack

The spec's choices are **largely sound but need version bumps and two architectural corrections**:

1. **Next.js 15 instead of "14+"** -- Next.js 15 is the current production-stable LTS. Next.js 16 exists but is bleeding-edge. The spec should target 15.
2. **pgboss requires a direct (unpooled) Neon connection** -- pgboss uses LISTEN/NOTIFY, which is incompatible with Neon's PgBouncer transaction-mode pooling. The project needs two connection strings: pooled for the app, direct for pgboss. This is the single biggest hidden gotcha in the spec.
3. **BlockNote's Markdown round-trip is lossy** -- The spec correctly identifies this risk. The dual-storage strategy (JSON for editing, Markdown for the canonical record) needs careful design up front.
4. **Use Vercel AI SDK + OpenRouter provider** instead of raw OpenRouter HTTP calls -- this gives you streaming, structured output, and type safety for free.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Next.js** | 15.5.x | Full-stack React framework | Stable LTS with Turbopack, React 19 support, App Router mature. Next.js 16 is available but still rolling out features incrementally. 15 is the safe production target for a greenfield project starting now. | HIGH |
| **React** | 19.x | UI library | Ships with Next.js 15. React 19 brings the React Compiler (experimental), improved hydration, and `use()` hook. | HIGH |
| **TypeScript** | 5.x | Type safety | Non-negotiable for a project this size. Drizzle and AI SDK both lean heavily on TypeScript inference. | HIGH |

### UI Layer

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **shadcn/ui** | latest (CLI-based) | Component library | Not a versioned npm package -- it copies components into your project. Recent updates (Jan-Feb 2026): unified Radix UI dependency, RTL support, Tailwind v4 support, new `npx shadcn create` visual builder. The dominant React component approach in the Next.js ecosystem. | HIGH |
| **Tailwind CSS** | 4.x | Utility-first CSS | shadcn/ui now supports Tailwind v4. Use v4 for new projects -- it's the current stable release with a new engine and CSS-first configuration. | HIGH |

### Markdown Editing (WYSIWYG)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **BlockNote** | 0.46.x (`@blocknote/react`) | Block-based WYSIWYG editor | Best batteries-included Notion-style editor for React. Active development (7 releases in 2025 alone), React 19 compatible since v0.34, multi-column support, toggle blocks, and AI integration hooks. Built on ProseMirror/Tiptap. | MEDIUM |

**Critical caveat: Markdown storage strategy.** BlockNote's native format is JSON. Its Markdown export (`blocksToMarkdownLossy`) is explicitly lossy:
- Children of non-list blocks get un-nested
- Some styles are stripped
- Table export has known bugs (issue #1377)
- Not all Markdown symbols round-trip cleanly on import

**Recommended approach for CodeWiki:**
- **Store content as raw Markdown** in the database (as the spec requires) -- this is the canonical format consumed by AI, search, and rendering
- **Store BlockNote JSON alongside** in a `content_json` column for lossless round-trip editing
- On save: `blocksToMarkdownLossy()` writes to `content_markdown`, `editor.document` writes to `content_json`
- On edit load: if `content_json` exists, load from it; if only Markdown exists (AI-generated), use `tryParseMarkdownToBlocks()`
- This dual-storage pattern is the standard approach when BlockNote must interoperate with Markdown-native systems

**Fallback: Milkdown** (v7.15.x) -- Use only if BlockNote's Markdown conversion proves unacceptable during Phase 5 prototyping. Milkdown is truly Markdown-native (every editor state has a 1:1 Markdown representation) but requires significantly more UI development work -- it is headless with minimal React integration out of the box.

### Markdown Rendering (Read-only)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **react-markdown** | 10.x | Markdown-to-React rendering | Mature, well-maintained, plugin-based architecture via unified/remark/rehype. 7,866 dependents on npm. | HIGH |
| **remark-gfm** | latest | GitHub-Flavored Markdown | Tables, strikethrough, task lists, autolinks. Required for wiki content. | HIGH |
| **rehype-highlight** | latest | Syntax highlighting | For code blocks in technical view. Lightweight alternative to Prism. | HIGH |
| **rehype-slug** + **rehype-autolink-headings** | latest | Heading anchors | Generates IDs for headings and adds anchor links. Standard for wiki navigation. | MEDIUM |

### Database

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Neon Postgres** | (managed service) | Primary database | Serverless Postgres with autoscaling, branching for dev/staging, and scale-to-zero. Well-suited for single-tenant deployment. Free tier is generous for internal tools. | HIGH |
| **Drizzle ORM** | 0.45.x | Type-safe ORM | Lightweight, SQL-like API, excellent Postgres support including full-text search via raw SQL helpers. First-class support for Neon. Drizzle Kit for migrations. v1.0 beta in progress with relational API v2. | HIGH |
| **drizzle-kit** | latest | Migrations | Schema-first migrations. `drizzle-kit generate` + `drizzle-kit migrate`. | HIGH |
| **@neondatabase/serverless** | latest | Neon driver | Neon's custom Postgres driver optimized for serverless -- uses WebSockets/HTTPS instead of TCP. Required for edge/serverless functions in Next.js. | MEDIUM |
| **postgres** (porsager/postgres) | latest | Direct Postgres driver | For pgboss and any operations needing direct (unpooled) connections. More traditional TCP driver. | MEDIUM |

**Two connection strings required:**
```
DATABASE_URL=postgresql://...@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb  # Pooled (app)
DATABASE_URL_UNPOOLED=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/neondb  # Direct (pgboss)
```

### Authentication

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **next-auth** (Auth.js v5) | 5.x (beta) | Authentication | Install via `npm i next-auth@beta`. Despite the "beta" tag, Auth.js v5 is widely used in production and is the only version compatible with Next.js 15 App Router. The v4 stable line does not support App Router properly. Official Drizzle adapter available. | MEDIUM |
| **@auth/drizzle-adapter** | 1.11.x | Database adapter | Official adapter, actively maintained (published 3 days ago as of research date). Supports custom schema definitions for users, accounts, sessions tables. | HIGH |

**Risk note:** Auth.js v5 has been in "beta" for over 2 years. Despite this label, it is the recommended path. There is no realistic alternative for Next.js 15+ App Router auth. The community has adopted it broadly. Install with `next-auth@beta` and pin the version.

### AI Integration

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Vercel AI SDK** | 6.x (`ai` npm package) | AI integration framework | The standard TypeScript AI toolkit. Provides `streamText()`, `generateText()`, `streamObject()`, and `generateObject()` with unified APIs across providers. Version 6 (current) adds agents, tool execution, MCP support. | HIGH |
| **@openrouter/ai-sdk-provider** | 2.1.x | OpenRouter provider for AI SDK | Official OpenRouter provider -- plug directly into Vercel AI SDK. Supports 300+ models, streaming, tool calling. No need for raw HTTP calls. | HIGH |

**Why use Vercel AI SDK instead of raw OpenRouter HTTP:**
- Type-safe streaming with `streamText()` for Ask AI chat
- `generateObject()` with Zod schemas for structured AI responses (article generation JSON)
- Built-in token counting, retry logic, abort handling
- Provider-agnostic -- if you ever switch from OpenRouter, swap one provider import
- React hooks (`useChat`, `useCompletion`) for client-side streaming UI

### Job Queue

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **pg-boss** | 12.11.x | Postgres-backed job queue | No additional infrastructure beyond Postgres. Supports cron scheduling, automatic retries with exponential backoff, priority queues, dead letter queues, concurrency control. SKIP LOCKED for exactly-once delivery. 55 dependents, actively maintained. | HIGH |

**Critical: pgboss + Neon connection requirements:**
- pgboss uses `LISTEN/NOTIFY` for real-time job notification, which is **incompatible with PgBouncer transaction pooling** (Neon's default pooled endpoint)
- **Must use Neon's direct (unpooled) connection** for pgboss: the connection string without `-pooler` in the hostname
- **Must disable Neon Scale-to-Zero** or accept that listeners terminate when compute scales down (messages could be missed between scale-down and scale-up)
- Alternative: use `{ noSupervisor: true }` mode with polling via `send()`/`fetch()` API to avoid LISTEN/NOTIFY entirely. This works with pooled connections but loses real-time job pickup (polls on an interval instead).

**Recommended approach:** Use direct connection for the pgboss instance running in the Docker container. Since this is a single-tenant self-hosted app, connection limits are not a concern. Set `DATABASE_URL_UNPOOLED` as a separate env var.

### GitHub Integration

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **@octokit/rest** | 22.x | GitHub REST API client | Official GitHub SDK. Type-safe, well-documented, handles pagination. Use this, not raw fetch calls. | HIGH |

### Image Processing

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **sharp** | latest | Image resize/compress | High-performance native image processing. Next.js recommends sharp for production image optimization. Handles resize, JPEG compression, EXIF stripping. | HIGH |

### Notifications

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **@slack/web-api** | latest | Slack DM notifications | Official Slack SDK. Handles Bot token auth and DM sending. | HIGH |
| **@sendgrid/mail** | latest | Email notifications | Official SendGrid SDK. Simple transactional email API. | HIGH |

### Diff & Version History

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **diff** | 8.x | Text diffing | Standard JS diff library. v8 ships built-in TypeScript types (drop `@types/diff`). Supports unified diff, word diff, line diff. 7,866 dependents. | HIGH |

### Full-Text Search

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Postgres tsvector + GIN index** | (Postgres built-in) | Article search | No extra infrastructure. Drizzle supports this via custom types and `generatedAlwaysAs()` columns. 5-10x improvement on 10k-100k records with GIN indexes, up to 50x on larger sets. | HIGH |

**Implementation pattern with Drizzle:**
```typescript
// Custom tsvector type
const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector'; },
});

// In schema
searchVector: tsvector('search_vector')
  .generatedAlwaysAs(
    (): SQL => sql`to_tsvector('english', coalesce(${articles.title}, '') || ' ' || coalesce(${articles.contentMarkdown}, ''))`
  ),

// GIN index
index('idx_articles_search').using('gin', t.searchVector)

// Query
db.select().from(articles)
  .where(sql`${articles.searchVector} @@ plainto_tsquery('english', ${query})`)
  .orderBy(sql`ts_rank(${articles.searchVector}, plainto_tsquery('english', ${query})) DESC`)
```

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Turbopack** | Dev server bundler | Stable in Next.js 15. Default for `next dev --turbo`. 5-10x faster HMR than Webpack. |
| **ESLint** | Linting | Use `next lint` (built into Next.js) with flat config. |
| **Prettier** | Formatting | With `prettier-plugin-tailwindcss` for class sorting. |
| **Docker + Docker Compose** | Deployment | Single container for Next.js app. pgboss runs in-process. Neon Postgres is remote. Volume mount for `/data/images`. |

---

## Installation

```bash
# Core framework
npm install next@15 react@19 react-dom@19

# UI
npx shadcn@latest init
npm install tailwindcss@4

# Editor
npm install @blocknote/core @blocknote/react @blocknote/mantine
# OR if Milkdown fallback needed:
# npm install @milkdown/core @milkdown/preset-commonmark @milkdown/preset-gfm @milkdown/react @milkdown/theme-nord

# Markdown rendering
npm install react-markdown remark-gfm rehype-highlight rehype-slug rehype-autolink-headings

# Database
npm install drizzle-orm @neondatabase/serverless postgres
npm install -D drizzle-kit

# Auth
npm install next-auth@beta @auth/drizzle-adapter

# AI
npm install ai @openrouter/ai-sdk-provider zod

# Job queue
npm install pg-boss

# GitHub
npm install @octokit/rest

# Image processing
npm install sharp

# Notifications
npm install @slack/web-api @sendgrid/mail

# Diff
npm install diff

# Dev dependencies
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D eslint prettier prettier-plugin-tailwindcss
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| **Editor** | BlockNote 0.46.x | Milkdown 7.15.x | If BlockNote's Markdown lossy conversion is unacceptable for your use case. Milkdown is Markdown-native (1:1 state mapping) but requires building all UI from scratch -- headless only. |
| **Editor** | BlockNote 0.46.x | Tiptap 2.x | If you need maximum control over the editor and don't mind building the UI yourself. Tiptap is what BlockNote is built on. More flexibility, more work. |
| **ORM** | Drizzle 0.45.x | Prisma 6.x | If you prefer a more mature ORM with a larger community. Prisma is heavier, uses a query engine process, and has historically had slower cold starts in serverless. Drizzle is lighter and more SQL-like. |
| **AI SDK** | Vercel AI SDK 6.x | Raw OpenRouter HTTP | If you want zero framework dependency. But you'd lose streaming helpers, type safety, React hooks, and structured output parsing. Not recommended. |
| **Job queue** | pg-boss 12.x | BullMQ 5.x | If you already have Redis infrastructure. BullMQ is more mature for high-throughput queues but requires Redis. pg-boss's value is zero additional infrastructure. |
| **Search** | Postgres tsvector | Meilisearch / Typesense | If you need typo-tolerant, faceted search at scale. For an internal wiki with <100k articles, Postgres full-text search is more than adequate and avoids another service. |
| **Auth** | Auth.js v5 (next-auth@beta) | Lucia Auth | If you want a non-beta auth library. However, Lucia announced deprecation in favor of building custom auth. Auth.js v5 is the ecosystem standard despite the beta label. |
| **Framework** | Next.js 15 | Next.js 16 | If you want the absolute latest features (Cache Components, PPR). Next.js 16 is stable but newer and less battle-tested. 15 has more community resources and known patterns. |
| **CSS** | Tailwind v4 | Tailwind v3 | Only if shadcn/ui components you need haven't been updated for v4. As of Feb 2026, shadcn supports v4 fully. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **next-auth@4 (stable)** | Does not properly support Next.js 15 App Router. The v4 line is effectively legacy. | `next-auth@beta` (Auth.js v5) |
| **Neon pooled connection for pgboss** | LISTEN/NOTIFY is incompatible with PgBouncer transaction pooling. pgboss will fail to receive job notifications. | Direct (unpooled) Neon connection |
| **Raw fetch() for OpenRouter** | You lose streaming helpers, type safety, abort handling, token counting, and React hooks. | Vercel AI SDK 6 + @openrouter/ai-sdk-provider |
| **Storing only Markdown with BlockNote** | Markdown round-trip is lossy. Editing a Markdown-only article will subtly corrupt formatting over multiple edit cycles. | Dual storage: JSON for editing, Markdown for rendering/AI/search |
| **Storing only BlockNote JSON** | Breaks the "Markdown-native" principle. AI pipeline, search indexing, and diff all need raw Markdown. | Dual storage: both formats |
| **Prisma** (for this project) | Heavier runtime, separate query engine process, slower cold starts. Drizzle is better for lightweight single-tenant apps with Neon. | Drizzle ORM |
| **CKEditor / TinyMCE / Quill** | Legacy WYSIWYG editors. Not block-based, poor modern React integration, heavy bundles. | BlockNote |
| **Redis-based job queues (BullMQ)** | Requires additional infrastructure. The spec explicitly avoids extra services beyond Postgres. | pg-boss (Postgres-native) |
| **Elasticsearch / Algolia** | Overkill for an internal wiki with <100k articles. Adds infrastructure and cost. | Postgres full-text search |

---

## Stack Patterns by Variant

**If Neon Scale-to-Zero is enabled (cost savings):**
- Use pgboss with `{ noSupervisor: true }` and polling via `send()`/`fetch()` API
- Run a separate cron job (e.g., Next.js API route called by external cron) to periodically process the queue
- Accept higher latency on job pickup (~30-60s polling interval vs. instant LISTEN/NOTIFY)

**If Neon Scale-to-Zero is disabled (recommended for production):**
- Use pgboss with direct (unpooled) connection and full LISTEN/NOTIFY support
- pgboss runs in-process in the Next.js server with supervisor enabled
- Real-time job pickup, cron scheduling, and maintenance all work natively

**If BlockNote Markdown proves unacceptable:**
- Switch to Milkdown 7.15.x for the editor
- Drop the dual-storage pattern -- Milkdown is Markdown-native, store only Markdown
- Budget 2-3x more time for editor UI (Milkdown is headless -- you build the toolbar, menus, etc.)
- Lose some DX niceties (slash menu, drag-and-drop blocks, animations)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.5.x | React 19.x | Built-in support. React 19 is required for Next.js 15. |
| @blocknote/react 0.46.x | React 19.x | Compatible since BlockNote v0.34 (July 2025). |
| next-auth@beta (v5) | Next.js 15.x, Drizzle 0.45.x | Use `@auth/drizzle-adapter` for Drizzle integration. |
| Drizzle ORM 0.45.x | @neondatabase/serverless, postgres | Use `@neondatabase/serverless` for pooled connections, `postgres` for direct. |
| pg-boss 12.x | Node 22.12+ | Requires Node 22.12 or higher. Ensure Docker image uses Node 22 LTS. |
| Vercel AI SDK 6.x | @openrouter/ai-sdk-provider 2.1.x | Use `createOpenRouter()` provider factory. |
| shadcn/ui | Tailwind CSS 4.x, Radix UI (unified) | As of Jan 2026, shadcn uses single `radix-ui` package instead of multiple `@radix-ui/react-*`. |
| sharp | Node 22.x | Native module -- ensure Docker image has build tools or use prebuilt binaries. |

**Node.js version requirement:** Node 22.12+ (required by pg-boss 12.x). Use `node:22-alpine` as Docker base image.

---

## Sources

- [BlockNote official docs -- Format Interoperability](https://www.blocknotejs.org/docs/foundations/supported-formats) -- Markdown lossy export confirmed (HIGH confidence)
- [BlockNote Markdown export docs](https://www.blocknotejs.org/docs/features/export/markdown) -- `blocksToMarkdownLossy()` API details (HIGH confidence)
- [BlockNote GitHub releases](https://github.com/TypeCellOS/BlockNote/releases) -- Version 0.44 (Dec 2025), 0.46 latest (HIGH confidence)
- [BlockNote table export bug #1377](https://github.com/TypeCellOS/BlockNote/issues/1377) -- Known table rendering issue in Markdown export (HIGH confidence)
- [pg-boss GitHub](https://github.com/timgit/pg-boss) -- v12.11.2, Node 22.12+ requirement, features confirmed (HIGH confidence)
- [pg-boss serverless discussion #403](https://github.com/timgit/pg-boss/discussions/403) -- noSupervisor mode for serverless (HIGH confidence)
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) -- PgBouncer transaction mode, LISTEN/NOTIFY incompatible (HIGH confidence)
- [Neon LISTEN/NOTIFY guide](https://neon.com/guides/pub-sub-listen-notify) -- Scale-to-Zero terminates listeners (HIGH confidence)
- [PgBouncer features page](https://www.pgbouncer.org/features.html) -- LISTEN not supported in transaction mode (HIGH confidence)
- [OpenRouter Vercel AI SDK docs](https://openrouter.ai/docs/community/vercel-ai-sdk) -- Integration pattern (HIGH confidence)
- [@openrouter/ai-sdk-provider npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider) -- v2.1.1, 198 dependents (HIGH confidence)
- [Vercel AI SDK 6 blog post](https://vercel.com/blog/ai-sdk-6) -- Version 6 features (HIGH confidence)
- [AI SDK migration guide 5 to 6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- Breaking changes documented (HIGH confidence)
- [Drizzle ORM full-text search guide](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) -- tsvector pattern (HIGH confidence)
- [Drizzle generated columns guide](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) -- generatedAlwaysAs pattern (HIGH confidence)
- [Auth.js Drizzle adapter](https://authjs.dev/reference/adapter/drizzle) -- Official adapter, v1.11.1 (HIGH confidence)
- [next-auth npm](https://www.npmjs.com/package/next-auth) -- v4.24.13 stable, v5 is @beta tag (HIGH confidence)
- [Next.js 15.5 blog](https://nextjs.org/blog/next-15-5) -- Turbopack stable, Node middleware (HIGH confidence)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Next.js 16 available but 15 is safe production target (MEDIUM confidence)
- [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog) -- Tailwind v4, unified Radix UI, Jan-Feb 2026 updates (HIGH confidence)
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) -- v10.1.0, remark/rehype plugin architecture (HIGH confidence)
- [Liveblocks rich text editor comparison 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) -- BlockNote vs Tiptap vs Milkdown analysis (MEDIUM confidence)
- [diff npm](https://www.npmjs.com/package/diff) -- v8.0.3, built-in TypeScript types (HIGH confidence)

---
*Stack research for: CodeWiki -- AI-augmented internal wiki*
*Researched: 2026-02-13*
