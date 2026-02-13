# Architecture Research

**Domain:** AI-augmented internal wiki (Next.js App Router + Neon Postgres)
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## System Overview

```
                           BROWSER
                             |
                     ┌───────┴───────┐
                     │   Next.js App  │
                     │  (App Router)  │
                     ├───────────────┤
                     │               │
              ┌──────┤  Middleware    │  ← Auth gate (NextAuth v5)
              │      │  (Edge)       │
              │      ├───────────────┤
              │      │               │
              │      │  Route Layer  │
              │      │  ┌─────────┐  │
              │      │  │ Pages   │  │  ← SSR / RSC rendering
              │      │  │ (RSC)   │  │
              │      │  ├─────────┤  │
              │      │  │ API     │  │  ← REST endpoints + streaming
              │      │  │ Routes  │  │
              │      │  ├─────────┤  │
              │      │  │ Server  │  │  ← Mutations, form handling
              │      │  │ Actions │  │
              │      │  └─────────┘  │
              │      ├───────────────┤
              │      │               │
              │      │  Service      │  ← Business logic layer
              │      │  Layer        │
              │      │  ┌─────────┐  │
              │      │  │ GitHub  │  │
              │      │  │ AI Pipe │  │
              │      │  │ Content │  │
              │      │  │ Notif   │  │
              │      │  └─────────┘  │
              │      ├───────────────┤
              │      │               │
              │      │  Data Access  │  ← Drizzle ORM queries
              │      │  Layer (DAL)  │
              │      └──────┬────────┘
              │             │
    ┌─────────┴─┐     ┌────┴─────────────────────────┐
    │  pgboss   │     │      Neon Postgres            │
    │  Worker   │────►│  ┌──────────┐  ┌───────────┐  │
    │ (in-proc) │     │  │  App     │  │  pgboss   │  │
    └───────────┘     │  │  Tables  │  │  Tables   │  │
                      │  └──────────┘  └───────────┘  │
                      └───────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
        │ OpenRouter │ │  GitHub   │ │ Slack /   │
        │ (AI)      │ │  API      │ │ SendGrid  │
        └───────────┘ └───────────┘ └───────────┘

    ┌──────────────────────────────┐
    │  Local Filesystem (/data/)   │
    │  └── images/{articleId}/     │
    └──────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Middleware** | Auth gate, route protection, session validation | NextAuth v5 `auth` export in `middleware.ts`, matcher config for protected routes |
| **Pages (RSC)** | Server-rendered wiki views, admin UI, search results | React Server Components in `app/` directory, data fetched server-side |
| **API Routes** | REST endpoints for CRUD, image upload/serve, AI streaming, webhooks | Route handlers in `app/api/` using Web Request/Response APIs |
| **Server Actions** | Form mutations (save article, post comment, update settings) | `"use server"` functions co-located with or imported by components |
| **Service Layer** | Business logic: sync orchestration, AI pipeline, merge strategy, notifications | Pure TypeScript modules in `lib/services/`, no framework coupling |
| **Data Access Layer** | Database queries, schema types, transaction management | Drizzle ORM queries in `lib/db/`, typed schema definitions |
| **pgboss Worker** | Background job processing: scheduled sync, AI generation, notifications | Singleton started via `instrumentation.ts`, processes jobs from Postgres |
| **External APIs** | OpenRouter (AI), GitHub (code sync), Slack/SendGrid (notifications) | Client wrappers in `lib/clients/`, API keys from `site_settings` table |
| **Local Filesystem** | Image storage for article uploads | Docker volume mount at `/data/images`, served via API route |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group: auth pages
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (wiki)/                   # Route group: main wiki
│   │   ├── layout.tsx            # Wiki shell (sidebar, nav, search)
│   │   ├── page.tsx              # Homepage / dashboard
│   │   ├── [slug]/               # Article view
│   │   │   ├── page.tsx
│   │   │   ├── edit/page.tsx
│   │   │   └── history/page.tsx
│   │   └── search/page.tsx
│   ├── (admin)/                  # Route group: admin panel
│   │   ├── layout.tsx            # Admin shell with sidebar
│   │   ├── settings/page.tsx
│   │   ├── github/page.tsx       # File tree, sync controls
│   │   ├── ai/page.tsx           # Prompts, model config
│   │   ├── users/page.tsx
│   │   └── notifications/page.tsx
│   ├── api/                      # Route handlers
│   │   ├── chat/route.ts         # AI streaming (Ask AI)
│   │   ├── images/
│   │   │   └── [articleId]/
│   │   │       ├── route.ts      # POST: upload
│   │   │       └── [filename]/
│   │   │           └── route.ts  # GET: serve image
│   │   ├── sync/route.ts         # POST: trigger manual sync
│   │   └── search/route.ts       # GET: full-text search
│   └── layout.tsx                # Root layout (providers, global UI)
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui components
│   ├── editor/                   # BlockNote editor wrapper
│   ├── chat/                     # Ask AI chat panel
│   ├── article/                  # Article view components
│   ├── admin/                    # Admin-specific components
│   └── common/                   # Layout, navigation, etc.
├── lib/                          # Non-React business logic
│   ├── db/                       # Database layer
│   │   ├── schema.ts             # Drizzle schema definitions
│   │   ├── migrations/           # Drizzle migration files
│   │   ├── index.ts              # DB client singleton(s)
│   │   └── queries/              # Typed query functions
│   │       ├── articles.ts
│   │       ├── versions.ts
│   │       ├── comments.ts
│   │       ├── settings.ts
│   │       └── ...
│   ├── services/                 # Business logic
│   │   ├── sync.ts               # GitHub sync orchestration
│   │   ├── ai-pipeline.ts        # AI article generation/update
│   │   ├── merge.ts              # AI + human content merge
│   │   ├── search.ts             # Full-text search logic
│   │   ├── notifications.ts      # Notification dispatcher
│   │   └── images.ts             # Image processing (sharp)
│   ├── clients/                  # External API wrappers
│   │   ├── openrouter.ts         # OpenRouter via AI SDK provider
│   │   ├── github.ts             # Octokit wrapper
│   │   ├── slack.ts              # Slack Web API
│   │   └── sendgrid.ts           # SendGrid
│   ├── jobs/                     # pgboss job definitions
│   │   ├── boss.ts               # pgboss singleton instance
│   │   ├── worker.ts             # Job handler registration
│   │   ├── sync-job.ts           # GitHub sync job handler
│   │   ├── ai-process-job.ts     # AI processing job handler
│   │   └── notification-job.ts   # Notification dispatch job
│   ├── auth/                     # Auth configuration
│   │   ├── config.ts             # NextAuth config (providers, callbacks)
│   │   └── index.ts              # Exported auth(), signIn, signOut
│   └── utils/                    # Shared utilities
│       ├── markdown.ts           # Markdown conversion helpers
│       ├── diff.ts               # Diff computation (npm diff)
│       └── prompts.ts            # Prompt template interpolation
├── middleware.ts                  # NextAuth middleware (route protection)
├── instrumentation.ts            # pgboss worker startup
└── types/                        # Shared TypeScript types
    └── index.ts
```

### Structure Rationale

- **Route groups `(auth)`, `(wiki)`, `(admin)`:** Separate layout shells without polluting URL paths. The wiki gets a sidebar+nav layout; admin gets its own admin shell; auth pages are minimal.
- **`lib/services/` vs `lib/db/queries/`:** Strict separation between business logic (orchestration, AI calls, merge strategy) and data access (SQL queries). Services call queries, never the other way around. This makes testing and refactoring straightforward.
- **`lib/jobs/`:** All pgboss job definitions isolated here. Jobs import from services, keeping the job handler thin (deserialize args, call service, report result).
- **`lib/clients/`:** External API wrappers are isolated so they can be mocked in tests and swapped if providers change (e.g., switching from SendGrid to Resend).
- **`components/editor/`:** BlockNote integration is complex enough to warrant its own directory. Handles Markdown round-trip, image paste hooks, and toolbar config.

## Architectural Patterns

### Pattern 1: Dual Database Connection Strategy

**What:** Use two different Neon connection types for different purposes -- the Neon HTTP driver for fast serverless queries in route handlers and RSC, and a standard `node-postgres` (pg) direct connection for pgboss.

**When to use:** Always in this project. pgboss requires persistent TCP connections with session support (it uses `LISTEN/NOTIFY`, `SKIP LOCKED`, advisory locks). The Neon serverless HTTP driver does not support these features. Meanwhile, route handlers benefit from the faster cold-start of HTTP connections.

**Trade-offs:**
- PRO: Each connection type optimized for its use case
- PRO: pgboss gets the persistent connections it needs
- CON: Two connection configurations to manage
- CON: Must use Neon's direct (unpooled) connection string for pgboss -- no `-pooler` suffix

**Confidence:** HIGH -- verified via Neon docs (direct connections for persistent/long-lived connections) and pgboss requirements (needs `pg`-compatible driver with session support).

**Example:**
```typescript
// lib/db/index.ts -- Application queries (HTTP driver, fast)
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });

// lib/jobs/boss.ts -- pgboss (node-postgres, persistent)
import PgBoss from 'pg-boss';

// IMPORTANT: Use the direct (unpooled) Neon connection string
// This is DATABASE_URL without the -pooler suffix, or a separate env var
export const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL_DIRECT!,
  // schema: 'pgboss' -- default, keeps pgboss tables separate
});
```

**Source:** [Neon connection types docs](https://neon.com/docs/connect/choose-connection), [pgboss GitHub](https://github.com/timgit/pg-boss)

---

### Pattern 2: pgboss Worker via instrumentation.ts

**What:** Start the pgboss worker inside Next.js's `instrumentation.ts` `register()` function. This hook is called exactly once when the Next.js server starts, making it the ideal place to initialize long-running background processes in a single-container deployment.

**When to use:** For this project's Docker single-container architecture where pgboss runs in-process with Next.js.

**Trade-offs:**
- PRO: No separate worker process or container needed
- PRO: Worker shares code with the application (services, queries)
- PRO: `register()` is guaranteed to run once per server instance
- CON: Heavy job processing shares CPU/memory with request handling
- CON: If Next.js crashes, worker stops too (acceptable for single-tenant)
- CON: Must gate on `NEXT_RUNTIME === 'nodejs'` (pgboss cannot run in Edge)

**Confidence:** MEDIUM-HIGH -- `instrumentation.ts` is documented for this purpose (Next.js official docs), and pgboss can run in-process. However, the combination is not widely documented in production examples, so integration testing is essential.

**Example:**
```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid Edge runtime issues
    const { startWorker } = await import('./lib/jobs/worker');
    await startWorker();
  }
}

// lib/jobs/worker.ts
import { boss } from './boss';
import { handleSyncJob } from './sync-job';
import { handleAIProcessJob } from './ai-process-job';
import { handleNotificationJob } from './notification-job';

export async function startWorker() {
  await boss.start();

  // Register job handlers
  await boss.work('github-sync', { teamConcurrency: 1 }, handleSyncJob);
  await boss.work('ai-process', { teamConcurrency: 1 }, handleAIProcessJob);
  await boss.work('send-notification', { teamConcurrency: 5 }, handleNotificationJob);

  // Schedule recurring sync (reads cron from site_settings at runtime)
  // Initial schedule set here; admin UI updates re-schedule via boss.schedule()
  console.log('pgboss worker started');
}
```

**Source:** [Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation), [pgboss serverless discussion](https://github.com/timgit/pg-boss/discussions/403)

---

### Pattern 3: AI Streaming via Vercel AI SDK + OpenRouter Provider

**What:** Use the Vercel AI SDK (`ai` package) with the official `@openrouter/ai-sdk-provider` for all AI interactions. For Ask AI chat, use `streamText()` in a route handler with `useChat()` on the client. For background article generation (pgboss jobs), use `generateText()` or `generateObject()` since there is no client to stream to.

**When to use:** Two distinct AI interaction modes require different patterns:
1. **Interactive (Ask AI):** User-facing, needs streaming for responsive UX
2. **Background (Article Generation):** Job-processed, no streaming needed, needs structured JSON output

**Trade-offs:**
- PRO: Unified AI SDK for both modes -- single provider config, consistent error handling
- PRO: OpenRouter provider gives model-agnostic flexibility (switch models via admin setting)
- PRO: `useChat()` hook handles message state, streaming, and retry automatically
- CON: OpenRouter adds a layer of indirection (latency, potential rate limits)
- CON: Model name from `site_settings` means provider must be created dynamically per-request

**Confidence:** HIGH -- OpenRouter has an official Vercel AI SDK provider (`@openrouter/ai-sdk-provider`), and the AI SDK's streaming pattern with Next.js App Router is well-documented.

**Example:**
```typescript
// app/api/chat/route.ts -- Ask AI streaming endpoint
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getSetting } from '@/lib/db/queries/settings';

export async function POST(req: Request) {
  const { messages, articleId } = await req.json();

  const apiKey = await getSetting('openrouter_api_key');
  const modelName = await getSetting('openrouter_model');

  const openrouter = createOpenRouter({ apiKey });

  const result = streamText({
    model: openrouter.chat(modelName),
    system: await buildSystemPrompt(articleId), // page or global prompt
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

// lib/services/ai-pipeline.ts -- Background article generation
import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const ArticleResponseSchema = z.object({
  articles: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    action: z.enum(['create', 'update']),
    content_markdown: z.string(),
    // ... rest of schema
  })),
});

export async function generateArticles(changedFiles: ChangedFile[]) {
  const openrouter = createOpenRouter({
    apiKey: await getSetting('openrouter_api_key'),
  });

  const result = await generateObject({
    model: openrouter.chat(await getSetting('openrouter_model')),
    schema: ArticleResponseSchema,
    prompt: await buildAnalysisPrompt(changedFiles),
  });

  return result.object;
}
```

**Source:** [AI SDK Next.js App Router docs](https://ai-sdk.dev/docs/getting-started/nextjs-app-router), [OpenRouter AI SDK provider](https://ai-sdk.dev/providers/community-providers/openrouter)

---

### Pattern 4: Content Merge Strategy (AI + Human Coexistence)

**What:** A three-phase merge process that preserves human edits when AI updates articles. This is the most architecturally critical pattern in the system.

**When to use:** Every time a code sync triggers an article update for an article that has `has_human_edits = true`.

**Trade-offs:**
- PRO: Human edits are never silently destroyed
- PRO: Conflict detection gives humans final say
- CON: Merge quality depends entirely on AI's ability to follow merge instructions
- CON: Complex articles with extensive human edits may produce poor merges
- CON: No structural diff -- relies on text-level diff, which can miss semantic changes

**Confidence:** MEDIUM -- The architectural pattern is sound and matches industry practice (Wikipedia's AI strategy, CMS best practices). However, the quality of the merge depends on the AI model's instruction following, which needs empirical validation. The fallback (flag for human review) is the safety net.

**Example:**
```typescript
// lib/services/merge.ts
import { diffLines } from 'diff';

interface MergeContext {
  lastAIVersion: string;       // Most recent ai_generated/ai_updated version
  currentContent: string;       // Current article (includes human edits)
  newAIContent: string;         // What AI wants to update to
}

export async function mergeArticleContent(ctx: MergeContext) {
  // Step 1: Compute what humans changed since last AI version
  const humanDiff = diffLines(ctx.lastAIVersion, ctx.currentContent);

  // Step 2: Compute what AI wants to change
  const aiDiff = diffLines(ctx.lastAIVersion, ctx.newAIContent);

  // Step 3: Detect potential conflicts (both changed same sections)
  const conflicts = detectConflicts(humanDiff, aiDiff);

  // Step 4: Send to AI for intelligent merge
  const mergePrompt = buildMergePrompt({
    previousAIContent: ctx.lastAIVersion,
    humanEdits: formatDiff(humanDiff),
    newAIContent: ctx.newAIContent,
    conflicts: conflicts,
  });

  const merged = await callAIForMerge(mergePrompt);

  return {
    content: merged.content,
    hasConflicts: conflicts.length > 0,
    conflictDescriptions: merged.conflictNotes,
    changeSource: 'ai_merged' as const,
  };
}
```

---

### Pattern 5: Markdown Storage with Editor Abstraction Layer

**What:** Store all content as raw Markdown in the database (the spec's requirement). Use an abstraction layer between the BlockNote editor and the database that handles bidirectional conversion. BlockNote's Markdown export is explicitly "lossy" (their own terminology), so the abstraction must handle edge cases and provide a fallback path.

**When to use:** Every article save and load operation.

**Critical architectural decision:** BlockNote recommends storing its native JSON format for lossless round-trips. The spec requires raw Markdown. This creates a tension that must be resolved at the architecture level.

**Recommended approach:** Store Markdown as the canonical format (per spec), but accept that some BlockNote-specific formatting may be simplified on save. The Markdown is the source of truth for AI processing, version diffs, and search indexing. When loading into BlockNote, convert Markdown to HTML first, then use `editor.tryParseHTMLToBlocks()` (BlockNote's recommended import path), which produces better results than direct Markdown parsing.

**Trade-offs:**
- PRO: Markdown is portable, AI-readable, diffable, searchable
- PRO: Not locked into BlockNote's proprietary JSON format
- CON: Some formatting nuances may be lost in round-trips
- CON: Tables, nested lists, and code blocks need careful testing
- RISK: If round-trip fidelity is unacceptable, must switch to Milkdown (spec acknowledges this)

**Confidence:** MEDIUM -- BlockNote explicitly calls its Markdown export "lossy." The spec's fallback to Milkdown is wise. This needs early validation in Phase 5 with representative content.

**Example:**
```typescript
// lib/utils/markdown.ts

// Loading: Markdown -> BlockNote
// Use HTML as intermediate format for better fidelity
import { marked } from 'marked';

export async function markdownToBlocks(
  editor: BlockNoteEditor,
  markdown: string
) {
  const html = await marked.parse(markdown);
  return editor.tryParseHTMLToBlocks(html);
}

// Saving: BlockNote -> Markdown
export async function blocksToMarkdown(
  editor: BlockNoteEditor
): Promise<string> {
  return editor.blocksToMarkdownLossy();
}
```

**Source:** [BlockNote format docs](https://www.blocknotejs.org/docs/foundations/supported-formats), [BlockNote Markdown export](https://www.blocknotejs.org/docs/features/export/markdown)

## Data Flow

### Request Flow (Wiki Page View)

```
Browser requests /articles/feature-auth
    |
    v
middleware.ts
    |-- Validates session via NextAuth v5 auth()
    |-- Redirects to /login if unauthenticated
    |
    v
app/(wiki)/[slug]/page.tsx (RSC)
    |-- Server component, runs on Node.js
    |-- Calls lib/db/queries/articles.ts -> getArticleBySlug()
    |-- Drizzle query via Neon HTTP driver (fast, no persistent conn)
    |-- Returns article data to component
    |
    v
React renders server-side
    |-- Article content rendered with react-markdown
    |-- Metadata sidebar populated
    |-- Tab navigation rendered (Article | Technical | Comments | History)
    |
    v
HTML streamed to browser
    |-- Client components hydrate (editor, chat panel, interactive elements)
```

### AI Sync Flow (Background Job)

```
pgboss cron fires "github-sync" job
    |
    v
sync-job.ts handler
    |-- Creates sync_logs entry (status: running)
    |
    v
lib/services/sync.ts
    |-- 1. FETCH: Octokit gets repo file tree
    |-- 2. FILTER: Apply excluded_paths + per-file exclusions
    |-- 3. DIFF: Compare SHAs to detect changes
    |-- 4. STORE: Update github_files table with new content
    |
    v
For each batch of changed files:
    |
    v
lib/services/ai-pipeline.ts
    |-- Assembles analysis prompt (changed files + existing article index)
    |-- Calls OpenRouter via AI SDK generateObject()
    |-- Parses structured JSON response
    |
    v
For each article in AI response:
    |
    ├── Article has_human_edits = false?
    |       |-- Direct overwrite, create article_version (ai_updated)
    |
    └── Article has_human_edits = true?
            |
            v
        lib/services/merge.ts
            |-- Fetch last AI version from article_versions
            |-- Compute human diff
            |-- Call AI for merge
            |-- Store as article_version (ai_merged)
            |-- If conflicts: set review flag
            |
            v
        lib/services/notifications.ts
            |-- Queue notification jobs for article editors
            |-- If conflicts: queue conflict notification
    |
    v
Update sync_logs (status: completed, files_changed, articles_updated)
```

### Ask AI Flow (Streaming)

```
User clicks "Ask about this feature" on article page
    |
    v
Client: useChat() hook initializes
    |-- Sends POST to /api/chat with messages + articleId
    |
    v
app/api/chat/route.ts
    |-- Reads OpenRouter config from site_settings
    |-- Assembles context:
    |     - Article content + technical view
    |     - Source file contents (from article_file_links -> github_files)
    |     - DB table schemas (from article_db_tables)
    |-- Builds system prompt from ask_ai_page_prompt template
    |-- Calls streamText() with OpenRouter provider
    |-- Returns streaming response
    |
    v
Client: useChat() receives stream
    |-- Renders Markdown chunks in real-time
    |-- On complete: saves conversation to ai_conversations
```

### Image Upload Flow

```
User pastes/uploads image in BlockNote editor
    |
    v
Editor image handler (client-side)
    |-- Captures File/Blob
    |-- POST to /api/images/[articleId]
    |
    v
app/api/images/[articleId]/route.ts
    |-- Validates auth, validates articleId exists
    |-- Passes image buffer to lib/services/images.ts
    |     - sharp: resize to max 1200x1200
    |     - sharp: convert to JPEG quality 80
    |     - sharp: strip EXIF metadata
    |-- Writes to /data/images/{articleId}/{uuid}_{timestamp}.jpg
    |-- Records in article_images table
    |-- Returns { url: "/api/images/{articleId}/{filename}" }
    |
    v
Editor inserts Markdown: ![image](/api/images/{articleId}/{filename})
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 users (target) | Single container, in-process pgboss, Neon free/basic tier. This is the design point. |
| 50-500 users | Same architecture holds. Neon scales compute independently. Add caching for rendered Markdown and article lists. Consider connection pooling for Drizzle queries. |
| 500+ users | Split pgboss worker to separate process/container. Add Redis for caching. Consider moving image storage to S3-compatible object storage. This is beyond scope for single-tenant. |

### Scaling Priorities

1. **First bottleneck: AI API rate limits.** OpenRouter and upstream model providers have rate limits. A large sync with many changed files will hit these. Mitigation: batch AI calls with delays, use pgboss retry with backoff.
2. **Second bottleneck: Neon connection limits.** Direct connections (needed for pgboss) are limited by compute size (~100 on basic tier). Mitigation: pgboss uses a small connection pool internally. Drizzle HTTP driver does not consume persistent connections.
3. **Third bottleneck: Image storage I/O.** Local filesystem is fine for hundreds of images. At thousands, consider object storage. Docker volume performance varies by host OS.

## Anti-Patterns

### Anti-Pattern 1: Running pgboss Through Neon's Connection Pooler

**What people do:** Use the pooled Neon connection string (with `-pooler` suffix) for pgboss because "pooling is better."
**Why it's wrong:** Neon's pooler uses PgBouncer in transaction mode. pgboss requires `LISTEN/NOTIFY`, advisory locks, and `SKIP LOCKED` across sessions, which are incompatible with transaction-mode pooling. Jobs will silently fail or deadlock.
**Do this instead:** Use Neon's direct (unpooled) connection string for pgboss. Use the HTTP driver for application queries.

### Anti-Pattern 2: Storing BlockNote JSON Instead of Markdown

**What people do:** Follow BlockNote's recommendation to store native JSON because it is "lossless."
**Why it's wrong for this project:** The spec requires Markdown-native storage. AI processes read and generate Markdown. Diffs are computed on Markdown. Search indexing operates on Markdown text. Storing BlockNote JSON would require conversion at every integration point and lock the system to BlockNote's format.
**Do this instead:** Accept the lossy Markdown conversion. Test early with representative content. Switch to Milkdown if fidelity is unacceptable.

### Anti-Pattern 3: AI Streaming in Server Actions

**What people do:** Use Next.js Server Actions for AI chat because "server actions are the modern pattern."
**Why it's wrong:** Server Actions are designed for mutations and form submissions. They do not support streaming responses well. The AI SDK's `streamText()` returns a `Response` object designed for Route Handlers, not Server Actions. Server Actions also have different caching and revalidation semantics that can interfere with chat.
**Do this instead:** Use a Route Handler (`app/api/chat/route.ts`) for AI streaming. Use Server Actions for mutations (save article, post comment).

### Anti-Pattern 4: Synchronous AI Processing in Request Handlers

**What people do:** Call the AI pipeline directly from the sync API route and wait for all articles to generate before responding.
**Why it's wrong:** AI article generation for a full codebase sync can take 5-30+ minutes depending on the number of files and model speed. HTTP request timeouts will kill the connection. The admin sees no progress.
**Do this instead:** The sync API route queues a pgboss job and returns immediately with a job ID. The admin UI polls job status from pgboss tables. Long-running AI work happens in the background worker.

### Anti-Pattern 5: Global Singleton pgboss Instance Across Edge and Node Runtimes

**What people do:** Import the pgboss instance at the top level of a shared module and use it everywhere.
**Why it's wrong:** Next.js App Router can run code in both Edge and Node.js runtimes. pgboss requires Node.js (TCP sockets, `pg` driver). Importing pgboss in an Edge-compatible module causes build or runtime errors.
**Do this instead:** Only import pgboss in files that are guaranteed to run in Node.js. Use dynamic imports gated on `process.env.NEXT_RUNTIME === 'nodejs'`. For enqueuing jobs from route handlers, create a thin `enqueueJob()` function that dynamically imports the boss instance.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **OpenRouter** | `@openrouter/ai-sdk-provider` via Vercel AI SDK | API key + model from `site_settings`. Dynamic provider creation per-request. Rate limiting is upstream responsibility. |
| **GitHub API** | `@octokit/rest` for repo access, file content fetching | PAT or App token from `site_settings`. Handles pagination for large repos. Rate limit: 5000 req/hr for authenticated. |
| **Slack** | `@slack/web-api` for DM notifications | Bot token from `site_settings`. Users provide their Slack user ID. Fire-and-forget with retry via pgboss. |
| **SendGrid** | `@sendgrid/mail` for email notifications | API key from `site_settings`. Simple transactional emails. Fire-and-forget with retry via pgboss. |
| **Neon Postgres** | HTTP driver (Drizzle queries) + Direct connection (pgboss) | Two connection strings. HTTP for fast queries, direct for persistent jobs. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route handlers <-> Services | Direct function calls | Services are pure TypeScript, imported directly. No HTTP between them. |
| Services <-> Data Access | Direct function calls | Services call typed Drizzle query functions. Never raw SQL in services. |
| Route handlers <-> pgboss | Enqueue via `boss.send()` | Routes enqueue jobs; workers process them. No direct service calls from routes for long operations. |
| pgboss worker <-> Services | Direct function calls | Worker handlers are thin wrappers that call service functions. |
| Client <-> AI | HTTP streaming via Route Handler | Client uses `useChat()` hook -> POST to `/api/chat` -> streamed response. |
| Admin UI <-> pgboss status | Drizzle queries on pgboss tables | Admin reads job status by querying pgboss's internal Postgres tables directly. |

## Build Order (Dependency Graph)

The architecture implies a specific build order based on what depends on what:

```
Phase 1: Foundation
├── Database schema + Drizzle setup (everything depends on this)
├── Auth (NextAuth v5 + middleware)
└── Basic layout shell

Phase 2: Data Pipeline Setup
├── pgboss initialization (instrumentation.ts + boss.ts)
│   └── Requires: Database schema (pgboss auto-creates its tables)
├── GitHub API client
│   └── Requires: site_settings queries (API keys)
├── Sync service
│   └── Requires: pgboss + GitHub client + github_files queries
└── Admin settings UI
    └── Requires: Auth (admin role check)

Phase 3: AI Core
├── OpenRouter client (AI SDK + provider)
│   └── Requires: site_settings queries (API key, model)
├── AI pipeline service
│   └── Requires: OpenRouter client + sync service output
├── Merge service
│   └── Requires: AI pipeline + article_versions queries + diff library
└── Admin prompt editors
    └── Requires: Admin settings UI

Phase 4: Content Display
├── Wiki viewer (article view, Markdown rendering)
│   └── Requires: Articles in DB (from AI pipeline)
├── Navigation (sidebar, categories, breadcrumbs)
│   └── Requires: Categories + articles queries
└── Full-text search
    └── Requires: tsvector triggers on articles

Phase 5: Content Editing
├── BlockNote integration + Markdown round-trip
│   └── Requires: Wiki viewer (need to see the result)
├── Image handling (sharp + filesystem + API routes)
│   └── Requires: Docker volume mount config
└── Version history + diff viewer
    └── Requires: article_versions populated

Phase 6-9: Features layered on top
├── Technical View (requires article_file_links populated by AI)
├── Comments + Mentions (requires articles + users)
├── Ask AI streaming (requires OpenRouter client + article context)
└── Notifications (requires comments + mentions + sync events)
```

**Key dependency insight:** The AI pipeline (Phase 3) must work before the wiki has content to display (Phase 4). This means Phases 1-3 produce a system with an admin panel and background processing but no user-facing wiki yet. This is correct -- the wiki needs articles before it can be viewed.

## Sources

- [Neon connection types and pooling](https://neon.com/docs/connect/choose-connection) -- HIGH confidence
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) -- HIGH confidence
- [Drizzle ORM Neon integration](https://orm.drizzle.team/docs/connect-neon) -- HIGH confidence
- [pgboss GitHub repository](https://github.com/timgit/pg-boss) -- HIGH confidence
- [pgboss serverless discussion #403](https://github.com/timgit/pg-boss/discussions/403) -- MEDIUM confidence
- [Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation) -- HIGH confidence
- [Next.js background worker discussion #24530](https://github.com/vercel/next.js/discussions/24530) -- LOW confidence (community discussion)
- [Vercel AI SDK Next.js App Router docs](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) -- HIGH confidence
- [OpenRouter AI SDK provider](https://ai-sdk.dev/providers/community-providers/openrouter) -- HIGH confidence
- [OpenRouter AI SDK provider npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider) -- HIGH confidence
- [BlockNote format interoperability](https://www.blocknotejs.org/docs/foundations/supported-formats) -- HIGH confidence
- [BlockNote Markdown export](https://www.blocknotejs.org/docs/features/export/markdown) -- HIGH confidence
- [NextAuth.js v5 / Auth.js docs](https://authjs.dev/getting-started/migrating-to-v5) -- MEDIUM confidence (docs still evolving)
- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure) -- HIGH confidence

---
*Architecture research for: CodeWiki (AI-augmented internal wiki)*
*Researched: 2026-02-13*
