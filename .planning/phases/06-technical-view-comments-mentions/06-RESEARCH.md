# Phase 6: Technical View, Comments & Mentions - Research

**Researched:** 2026-02-13
**Domain:** Technical view rendering, inline code viewer, threaded comments, @mention autocomplete
**Confidence:** HIGH

## Summary

Phase 6 activates two of the four article tabs that currently exist as placeholders: Technical View and Comments. The Technical View tab needs to display AI-generated file links and DB table mappings (already populated by the pipeline into `article_file_links` and `article_db_tables`), provide an inline code viewer for source files fetched on-demand from GitHub, support deep links to GitHub, and be editable via the existing BlockNote editor. The Comments tab needs threaded comments with Markdown rendering, resolve/unresolve functionality, and @mention autocomplete that creates mention records.

The existing codebase provides strong foundations: the tab system (`ArticleTabs` component) already renders four tabs with Comments disabled; the pipeline already populates `article_file_links` and `article_db_tables` during sync; `shiki` v3.22 is already installed for syntax highlighting; the `getOctokit`/`getRepoConfig` utilities and `fetchFileContents` function handle GitHub API calls; the `ArticleContent` component renders Markdown server-side; and shadcn/ui provides all needed UI primitives. The primary new dependencies are `react-mentions-ts` for @mention autocomplete (React 19 + TypeScript compatible) and a new API route for on-demand file content fetching.

**Primary recommendation:** Build the Technical View as a server component that queries `article_file_links` + `article_db_tables` and renders structured cards with GitHub deep links, plus a client-side code viewer dialog that fetches file content via API route and highlights with shiki's `codeToHtml`. Build comments as a client component tree using recursive rendering with `react-mentions-ts` for the input, and small Markdown rendering via `react-markdown` (already installed).

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shiki | ^3.22.0 | Syntax highlighting for inline code viewer | Already used via `@shikijs/rehype` for article rendering; reuse `codeToHtml` directly for the code viewer |
| @shikijs/rehype | ^3.22.0 | Rehype plugin for markdown code blocks | Already integrated in ArticleContent |
| react-markdown | ^10.1.0 | Markdown rendering in comments | Already used for article content; reuse MarkdownAsync for comment bodies |
| remark-gfm | ^4.0.1 | GFM support in comment markdown | Already installed |
| @octokit/rest | ^22.0.1 | GitHub API for on-demand file fetching | Already used throughout; reuse `getOctokit`/`getRepoConfig` |
| @blocknote/react | ^0.46.2 | WYSIWYG editor for technical view editing | Already integrated for article editing |
| drizzle-orm | ^0.45.1 | Database queries for comments, mentions, file links | Already used everywhere |
| lucide-react | ^0.564.0 | Icons (FileCode, ExternalLink, MessageSquare, etc.) | Already used project-wide |
| sonner | ^2.0.7 | Toast notifications | Already used for feedback |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-mentions-ts | latest | @mention autocomplete in comment textarea | Comment input with @ trigger for user search |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-mentions-ts | Custom textarea with manual @ detection | Custom solution requires handling cursor position, dropdown positioning, keyboard navigation -- deceptively complex |
| react-mentions-ts | @webscopeio/react-textarea-autocomplete | Older library, not React 19 native, less TypeScript support |
| react-shiki (client component) | shiki codeToHtml in API route | API route approach is simpler -- highlight server-side, return HTML, render with dangerouslySetInnerHTML. Avoids shipping shiki to client bundle |

**Installation:**
```bash
npm install react-mentions-ts
```

## Architecture Patterns

### Technical View Tab Architecture

```
src/
├── components/wiki/
│   ├── technical-view.tsx          # Server component: renders file links + DB tables
│   ├── file-link-card.tsx          # Card for each linked file with GitHub deep link
│   ├── code-viewer-dialog.tsx      # Client component: dialog with syntax-highlighted code
│   ├── db-table-card.tsx           # Card for each related DB table with columns
│   └── article-tabs.tsx            # UPDATE: add technicalView prop content, enable comments
├── app/api/
│   └── github/
│       └── file-content/
│           └── route.ts            # API route: fetch file from GitHub, highlight with shiki, return HTML
├── lib/wiki/
│   └── queries.ts                  # ADD: getArticleFileLinks, getArticleDbTables queries
└── lib/wiki/
    └── actions.ts                  # ADD: saveTechnicalView server action
```

### Comments & Mentions Architecture

```
src/
├── components/wiki/
│   ├── comments-section.tsx        # Client component: full comment thread for an article
│   ├── comment-thread.tsx          # Recursive comment rendering (parent + replies)
│   ├── comment-card.tsx            # Single comment: avatar, name, timestamp, markdown body, resolve
│   ├── comment-input.tsx           # react-mentions-ts textarea with @ autocomplete
│   └── article-tabs.tsx            # UPDATE: add commentsContent prop, enable tab
├── app/api/
│   ├── articles/[id]/
│   │   └── comments/
│   │       └── route.ts            # GET (list), POST (create) comments
│   │   └── comments/[commentId]/
│   │       ├── route.ts            # PATCH (update), DELETE
│   │       └── resolve/
│   │           └── route.ts        # POST toggle resolve/unresolve
│   └── users/
│       └── search/
│           └── route.ts            # GET user search for @mention autocomplete
├── lib/wiki/
│   └── queries.ts                  # ADD: getArticleComments, searchUsers
└── lib/wiki/
    └── actions.ts                  # ADD: createComment, resolveComment server actions
```

### Pattern 1: On-Demand File Content Fetching via API Route

**What:** API route that fetches a single file from GitHub and returns syntax-highlighted HTML.
**When to use:** When user clicks a file link in the Technical View to view code inline.
**Example:**
```typescript
// src/app/api/github/file-content/route.ts
// Source: existing fetchFileContents pattern in src/lib/ai/analyze.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOctokit, getRepoConfig } from "@/lib/github/client";
import { withRetry } from "@/lib/github/retry";
import { codeToHtml } from "shiki";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const octokit = await getOctokit();
  const config = await getRepoConfig();

  const { data } = await withRetry(() =>
    octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: filePath,
      ref: config.branch,
    })
  );

  if (Array.isArray(data) || data.type !== "file") {
    return NextResponse.json({ error: "Not a file" }, { status: 400 });
  }

  const content = Buffer.from(data.content, "base64").toString("utf-8");
  const lang = inferLanguage(filePath); // helper based on file extension

  const html = await codeToHtml(content, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });

  return NextResponse.json({ html, content, lang, path: filePath });
}
```

### Pattern 2: GitHub Deep Link Construction

**What:** Build clickable links to the source file on GitHub.
**When to use:** Every file link card in the Technical View.
**Example:**
```typescript
// Construct GitHub deep link from stored config
// Source: existing getRepoConfig pattern
function buildGitHubUrl(owner: string, repo: string, branch: string, filePath: string): string {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
}
```

### Pattern 3: Recursive Comment Threading

**What:** Render comments as a tree with parent comments and nested replies.
**When to use:** Comments tab on every article.
**Example:**
```typescript
// Recursive comment rendering pattern
interface CommentWithReplies {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  contentMarkdown: string;
  isResolved: boolean;
  createdAt: Date;
  replies: CommentWithReplies[];
}

function CommentThread({ comment, depth = 0 }: { comment: CommentWithReplies; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-8 border-l pl-4" : ""}>
      <CommentCard comment={comment} />
      {comment.replies.map((reply) => (
        <CommentThread key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}
```

### Pattern 4: @Mention Autocomplete with react-mentions-ts

**What:** Textarea with @ trigger that searches users and creates mention markup.
**When to use:** Comment input form.
**Example:**
```typescript
import { MentionsInput, Mention } from "react-mentions-ts";

// Data format: { id: string; display: string }
// Markup format: @[__display__](__id__) -- parsed on submit to extract mention IDs

async function fetchUsers(query: string, callback: (data: any[]) => void) {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
  const users = await res.json();
  callback(users.map((u: any) => ({ id: u.id, display: u.name || u.email })));
}

<MentionsInput value={value} onChange={(e) => setValue(e.target.value)}>
  <Mention trigger="@" data={fetchUsers} />
</MentionsInput>
```

### Pattern 5: Technical View Editing (Reuse BlockNote)

**What:** The technical view markdown is editable using the same editor as articles.
**When to use:** TECH-04 requirement -- user clicks "Edit Technical View" button.
**Example:**
```typescript
// Reuse the existing EditorLoader pattern
// Navigate to /wiki/[slug]/edit-technical or use a dialog/sheet
// Save to articles.technicalViewMarkdown + create version record
```

### Anti-Patterns to Avoid

- **Fetching all file contents eagerly:** Do NOT fetch GitHub file contents when rendering the Technical View tab. Fetch on-demand only when the user clicks "View Code" on a specific file. This avoids slow page loads and unnecessary API calls.
- **Client-side shiki bundle:** Do NOT ship shiki to the client. Highlight server-side in the API route and return pre-highlighted HTML. The project already has shiki CSS variables for dual-theme support.
- **Flat comment loading:** Do NOT load comments as a flat list and build the tree client-side. Build the tree server-side in the query/API response to reduce client complexity.
- **Custom @mention implementation:** Do NOT build custom cursor detection and dropdown positioning. Use `react-mentions-ts` -- it handles the 20+ edge cases (cursor position, overflow, keyboard nav, mobile, etc.).
- **Storing mentions inline in comment markdown:** Parse mention markup (@[name](id)) on comment submission to extract mentioned user IDs and insert into the `mentions` table. Do NOT try to detect mentions by scanning rendered comment text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| @mention autocomplete | Custom textarea with cursor position detection, dropdown positioning, keyboard navigation | `react-mentions-ts` | 20+ edge cases: caret position tracking, overflow handling, keyboard navigation, mobile support, accessibility, suggestion filtering |
| Syntax highlighting | Custom tokenizer or regex-based highlighter | `shiki` (already installed) | 600+ languages, VS Code-quality themes, battle-tested |
| Markdown in comments | Custom Markdown parser | `react-markdown` + `remark-gfm` (already installed) | XSS-safe, GFM support, custom components |
| Comment tree building | Client-side tree assembly from flat array | Server-side tree construction in API/query | Simpler client code, single traversal, consistent rendering |
| GitHub deep links | Manual URL construction with edge case handling | Simple template from `getRepoConfig()` values | Repo config already centralized in settings |

**Key insight:** The project already has all the heavy infrastructure (shiki, react-markdown, Octokit, Drizzle). Phase 6 is about composing existing tools into new UI, not installing new frameworks.

## Common Pitfalls

### Pitfall 1: Shiki Language Detection from File Extension
**What goes wrong:** File has unusual extension (.tsx, .mjs, .cjs, .yml) or no extension, and shiki throws on unknown language.
**Why it happens:** shiki requires a valid language identifier; it doesn't auto-detect.
**How to avoid:** Create a robust `inferLanguage(filePath: string): string` helper that maps common extensions to shiki language IDs, with a `"text"` fallback for unknown extensions. Handle edge cases: Dockerfile, Makefile, .env, etc.
**Warning signs:** `ShikiError: Language not found` errors in the code viewer.

### Pitfall 2: Large File Content in Code Viewer
**What goes wrong:** User clicks "View Code" on a large file (>500KB), and the API route times out or returns huge HTML.
**Why it happens:** shiki processing + base64 decode + JSON response for a massive file.
**How to avoid:** Set a file size limit in the API route (e.g., 500KB). Show a "File too large for inline view" message with a GitHub deep link fallback. The existing `fetchFileContents` in the pipeline already skips files >1MB.
**Warning signs:** Slow code viewer loading, browser tab unresponsive.

### Pitfall 3: Comment Thread Depth Explosion
**What goes wrong:** Deeply nested comment threads create extremely indented UI that becomes unreadable.
**Why it happens:** Unlimited nesting depth in recursive rendering.
**How to avoid:** Limit visual nesting to 3-4 levels. After max depth, replies render at the same indentation with a "replying to @user" label. The spec says "one level deep, or nested" -- start with one level of replies (parent -> reply, no reply-to-reply) for simplicity.
**Warning signs:** UI breaks on narrow screens due to excessive left margins.

### Pitfall 4: N+1 Queries in Comment Loading
**What goes wrong:** Loading comments with user data issues one query per comment to fetch user info.
**Why it happens:** Naive implementation fetches comments then loops to get user avatars.
**How to avoid:** Use a single query with JOIN on users table to get all comment data including user name, avatar, and email in one shot. The existing `getArticleVersions` query demonstrates this pattern (joins users table).
**Warning signs:** Slow comment loading, many database queries in server logs.

### Pitfall 5: Mention Parsing on Display vs. Storage
**What goes wrong:** Mentions stored as raw markup `@[John](uuid)` display as-is instead of styled @John links.
**Why it happens:** No post-processing of mention markup when rendering comment markdown.
**How to avoid:** Parse the `react-mentions-ts` markup format before rendering. Either: (a) convert `@[display](id)` to a custom Markdown link format before passing to `react-markdown`, or (b) use a custom `react-markdown` component that detects mention patterns and renders styled links.
**Warning signs:** Users see `@[John Doe](uuid-here)` in rendered comments.

### Pitfall 6: Race Condition on Resolve/Unresolve
**What goes wrong:** Two users click resolve/unresolve simultaneously, resulting in inconsistent state.
**Why it happens:** No optimistic locking on resolve toggle.
**How to avoid:** Use a simple toggle pattern (read current state, flip it). Since `isResolved` is a boolean, even concurrent writes converge to the correct state. Add optimistic UI updates for responsiveness.
**Warning signs:** Resolve button shows wrong state after click.

## Code Examples

### Query: Get Article File Links with GitHub File Info
```typescript
// Source: pattern from existing pipeline.ts populateFileLinks
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articleFileLinks, githubFiles } from "@/lib/db/schema";

export async function getArticleFileLinks(articleId: string) {
  const db = getDb();
  return db
    .select({
      id: articleFileLinks.id,
      filePath: githubFiles.filePath,
      relevanceExplanation: articleFileLinks.relevanceExplanation,
      githubFileId: articleFileLinks.githubFileId,
    })
    .from(articleFileLinks)
    .innerJoin(githubFiles, eq(articleFileLinks.githubFileId, githubFiles.id))
    .where(eq(articleFileLinks.articleId, articleId));
}
```

### Query: Get Article DB Tables
```typescript
// Source: schema definition in schema.ts
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articleDbTables } from "@/lib/db/schema";

export async function getArticleDbTables(articleId: string) {
  const db = getDb();
  return db
    .select({
      id: articleDbTables.id,
      tableName: articleDbTables.tableName,
      columns: articleDbTables.columns,
      relevanceExplanation: articleDbTables.relevanceExplanation,
    })
    .from(articleDbTables)
    .where(eq(articleDbTables.articleId, articleId));
}
```

### Query: Get Comments Tree for Article
```typescript
// Source: recursive tree pattern from getCategoryTreeWithArticles in queries.ts
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";

export async function getArticleComments(articleId: string) {
  const db = getDb();

  const allComments = await db
    .select({
      id: comments.id,
      parentCommentId: comments.parentCommentId,
      contentMarkdown: comments.contentMarkdown,
      isResolved: comments.isResolved,
      resolvedBy: comments.resolvedBy,
      resolvedAt: comments.resolvedAt,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userId: comments.userId,
      userName: users.name,
      userImage: users.image,
      userAvatarUrl: users.avatarUrl,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.articleId, articleId))
    .orderBy(desc(comments.createdAt));

  // Build tree: top-level comments + nested replies
  const commentMap = new Map();
  const roots = [];

  for (const c of allComments) {
    commentMap.set(c.id, { ...c, replies: [] });
  }

  for (const c of commentMap.values()) {
    if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
      commentMap.get(c.parentCommentId).replies.push(c);
    } else {
      roots.push(c);
    }
  }

  // Sort replies oldest-first within each thread
  for (const c of commentMap.values()) {
    c.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return roots;
}
```

### Language Inference Helper
```typescript
// Map file extensions to shiki language identifiers
const EXT_MAP: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", rb: "ruby", rs: "rust", go: "go",
  java: "java", kt: "kotlin", swift: "swift", cs: "csharp",
  cpp: "cpp", c: "c", h: "c", hpp: "cpp",
  css: "css", scss: "scss", less: "less",
  html: "html", htm: "html", vue: "vue", svelte: "svelte",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", mdx: "mdx",
  sql: "sql", graphql: "graphql", gql: "graphql",
  sh: "bash", bash: "bash", zsh: "bash",
  dockerfile: "dockerfile", docker: "dockerfile",
  xml: "xml", svg: "xml",
  env: "properties", ini: "ini", conf: "ini",
  prisma: "prisma",
};

const FILENAME_MAP: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  ".env": "properties",
  ".gitignore": "gitignore",
};

export function inferLanguage(filePath: string): string {
  const filename = filePath.split("/").pop() ?? "";

  // Check exact filename matches first
  if (FILENAME_MAP[filename]) return FILENAME_MAP[filename];

  // Check extension
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "text";
}
```

### Mention Markup Parsing
```typescript
// react-mentions-ts default markup: @[display](id)
// Convert to a renderable format for react-markdown
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function processMentions(markdown: string): string {
  // Convert @[John Doe](uuid) -> **@John Doe** (or a custom format)
  return markdown.replace(MENTION_REGEX, "**@$1**");
}

// Extract mention user IDs from markup (for creating mention records)
function extractMentionIds(markup: string): string[] {
  const ids: string[] = [];
  let match;
  while ((match = MENTION_REGEX.exec(markup)) !== null) {
    ids.push(match[2]); // capture group 2 = user ID
  }
  return [...new Set(ids)]; // deduplicate
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| highlight.js | shiki (TextMate grammars) | 2023+ | VS Code-quality highlighting, dual-theme via CSS vars |
| react-mentions (JS) | react-mentions-ts (TypeScript) | 2024 | React 19 support, TypeScript-first, Tailwind v4 support |
| Client-side shiki | Server-side codeToHtml | shiki v1+ | Zero client JS for highlighting, faster render |

**Deprecated/outdated:**
- `highlight.js` in this context: shiki already installed and integrated, no reason to add another highlighter
- `react-mentions` (original): Lacks React 19 support; `react-mentions-ts` is the maintained TypeScript fork

## Open Questions

1. **Comment threading depth**
   - What we know: Spec says "Reply threading (one level deep, or nested)". Schema supports unlimited depth via `parentCommentId` self-reference.
   - What's unclear: Should we support multi-level nesting or limit to one level (parent + direct replies only)?
   - Recommendation: Start with one level of replies (simpler UI, covers 95% of use cases). The schema already supports deeper nesting if needed later.

2. **Technical view editing UX**
   - What we know: TECH-04 requires "same Markdown editor as articles." The existing `technicalViewMarkdown` field is stored on the article.
   - What's unclear: Should this be a separate edit page (`/wiki/[slug]/edit-technical`), a dialog/sheet overlay, or inline editing on the tab?
   - Recommendation: Use the same edit page pattern but with a query param (`/wiki/[slug]/edit?mode=technical`) or a separate route. Reuse `EditorLoader` and `ArticleEditor` with a `mode` prop. Saves to `articles.technicalViewMarkdown` and creates a version record.

3. **Notification triggering for mentions (Phase 7 dependency)**
   - What we know: CMNT-06 says "Mentions stored in mentions table and trigger notifications per user preferences." Notifications are Phase 7.
   - What's unclear: Should Phase 6 create the mention records only, or also trigger a basic notification stub?
   - Recommendation: Phase 6 creates mention records in the `mentions` table. Phase 7 hooks into mention creation to dispatch notifications. No notification logic in Phase 6.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/db/schema.ts` -- all table definitions for comments, mentions, articleFileLinks, articleDbTables
- Codebase: `src/lib/ai/pipeline.ts` -- existing `populateFileLinks` and `populateDbTables` patterns
- Codebase: `src/lib/ai/analyze.ts` -- existing `fetchFileContents` using Octokit
- Codebase: `src/components/wiki/article-tabs.tsx` -- current tab system with Comments disabled
- Codebase: `src/components/wiki/article-content.tsx` -- existing Markdown rendering with shiki
- Codebase: `src/lib/github/client.ts` -- Octokit factory and repo config
- Codebase: `src/components/editor/article-editor.tsx` -- existing BlockNote editor pattern
- [Shiki official docs](https://shiki.style/guide/) -- `codeToHtml` API, dual-theme support
- [react-mentions-ts GitHub](https://github.com/hbmartin/react-mentions-ts) -- React 19 + TypeScript mention library

### Secondary (MEDIUM confidence)
- [Shiki Next.js guide](https://shiki.style/packages/next) -- server-side highlighting patterns
- [GitHub REST API - repos.getContent](https://docs.github.com/en/rest/repos/contents) -- file content fetching

### Tertiary (LOW confidence)
- None -- all critical findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already installed; only new dep is react-mentions-ts (verified React 19 support)
- Architecture: HIGH - follows existing codebase patterns (queries, server components, API routes, client components)
- Pitfalls: HIGH - identified from codebase analysis (shiki lang detection, file size limits, N+1 queries, mention parsing)

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable -- all libraries are mature, no breaking changes expected)
