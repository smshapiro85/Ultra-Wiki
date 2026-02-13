# Phase 3: AI Processing Pipeline - Research

**Researched:** 2026-02-13
**Domain:** LLM-powered code analysis, article generation, three-way merge, structured AI output
**Confidence:** HIGH

## Summary

Phase 3 builds the core intelligence of CodeWiki: an AI pipeline that analyzes code changes from GitHub sync (Phase 2), generates or updates wiki articles via OpenRouter, and merges AI content with human edits using a three-way merge strategy. The pipeline has three distinct sub-systems: (1) an OpenRouter client that sends code to an LLM and receives structured JSON responses defining articles, (2) a three-way merge engine that preserves human edits when AI updates existing articles, and (3) background job orchestration that wires sync completion to AI processing to merge resolution.

The recommended approach uses the **Vercel AI SDK (`ai` v6)** with the **`@openrouter/ai-sdk-provider`** for all LLM interactions. This provides type-safe structured output via Zod schemas, streaming support, and automatic retry/error handling -- all without building a custom HTTP client. For three-way merge, **`node-diff3`** (v3.2.0) provides battle-tested diff3 merge with conflict detection, operating on line-split Markdown text. For unified diffs stored in `article_versions.diff_from_previous`, the existing spec calls for the **`diff`** npm package (already listed in the spec's tech stack). File content fetching from GitHub uses Octokit's `repos.getContent()` API with base64 decoding, noting the 1MB limit per file (use the Git Blobs API for files 1-100MB).

A critical architectural decision: the AI does NOT operate on BlockNote JSON directly. The pipeline works entirely in Markdown -- AI receives Markdown, generates Markdown, and the merge operates on Markdown. Conversion between BlockNote JSON and Markdown happens at the boundaries: `@blocknote/server-util`'s `ServerBlockNoteEditor` converts stored BlockNote JSON to Markdown before AI processing, and converts AI-generated Markdown back to BlockNote JSON for storage. This keeps the AI pipeline format-agnostic and the merge algorithm operating on human-readable text.

**Primary recommendation:** Use Vercel AI SDK v6 + `@openrouter/ai-sdk-provider` for structured LLM output, `node-diff3` for three-way merge on line-split Markdown, and `@blocknote/server-util` for server-side Markdown/JSON conversion at pipeline boundaries.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0 | Vercel AI SDK -- `generateText` with `Output.object()` for structured LLM output | De facto standard for AI in Next.js, type-safe structured output with Zod schemas, handles retries/streaming, 50k+ GitHub stars |
| `@openrouter/ai-sdk-provider` | ^2.1 | OpenRouter provider for Vercel AI SDK | Official OpenRouter integration, supports 300+ models, structured outputs, prompt caching |
| `node-diff3` | ^3.2.0 | Three-way merge with conflict detection | Battle-tested diff3 algorithm (mirrors GNU diffutils), line-based merge, conflict markers, MIT license |
| `diff` | ^8.0 | Two-way unified diff generation (for `diff_from_previous` column) | Listed in project spec tech stack, `createPatch`/`structuredPatch` for stored diffs |
| `@blocknote/server-util` | ^0.36.0 | Server-side BlockNote JSON to/from Markdown conversion | Official BlockNote package for server processing, `ServerBlockNoteEditor.create()` with `blocksToMarkdownLossy()` and `tryParseMarkdownToBlocks()` |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@octokit/rest` | ^22.0.1 | Fetch file content from GitHub (`repos.getContent`) | Retrieve actual file contents for AI analysis (Phase 2 only stored SHAs) |
| `drizzle-orm` | ^0.45.1 | All DB operations (articles, versions, categories, file links) | Every database interaction in the pipeline |
| `zod` | ^4.3.6 | Define structured output schemas for AI responses | Type-safe AI response parsing with Vercel AI SDK |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel AI SDK + provider | Direct `fetch()` to OpenRouter API | Raw fetch works but requires hand-rolling JSON schema enforcement, retry logic, error handling, token tracking. AI SDK provides all of this with type safety |
| Vercel AI SDK + provider | `@openrouter/sdk` (official SDK) | The official SDK is ESM-only and in beta with breaking changes. The AI SDK provider is more mature and integrates natively with the Vercel AI SDK ecosystem |
| `node-diff3` | `three-way-merge` npm | `three-way-merge` has fewer downloads, less active maintenance. `node-diff3` is more established with clear conflict representation |
| `node-diff3` | AI-based merge (send both versions to LLM) | Unreliable -- LLM may silently drop content. Deterministic merge is essential for trust. Use AI only for semantic conflict *detection*, not resolution |
| `@blocknote/server-util` | Manual Markdown parsing | Lossy and error-prone. The official server util ensures round-trip fidelity with the editor's JSON format |

**Installation:**
```bash
npm install ai @openrouter/ai-sdk-provider node-diff3 diff @blocknote/server-util
```

**Note on Zod v4:** The project already uses Zod v4 (`^4.3.6`). Vercel AI SDK v6 supports Zod v3 and v4 directly or via `zodSchema()`. If any compatibility issues arise with direct Zod v4 usage, wrap schemas with `import { zodSchema } from 'ai'`.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    ai/
      client.ts              # OpenRouter provider factory (reads settings from DB)
      schemas.ts             # Zod schemas for AI structured output
      prompts.ts             # Prompt template builders (analysis, article style)
      analyze.ts             # Code analysis: changed files -> article plan
      generate.ts            # Article generation: plan -> markdown content
      pipeline.ts            # Top-level orchestrator: sync result -> articles
    merge/
      three-way.ts           # Three-way merge using node-diff3
      diff.ts                # Unified diff generation using diff package
      conflict.ts            # Conflict detection and review banner logic
    content/
      markdown.ts            # BlockNote JSON <-> Markdown conversion helpers
      version.ts             # Article version creation and tracking
  app/
    api/
      admin/
        sync/
          route.ts           # MODIFIED: after sync, trigger AI pipeline
```

### Pattern 1: Structured AI Output with Zod Schema
**What:** Define the exact shape of AI responses using Zod, and let the AI SDK enforce it.
**When to use:** Every LLM call that returns structured data (analysis results, article content).
**Example:**
```typescript
// Source: Vercel AI SDK docs + OpenRouter AI SDK provider README
import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

// Create provider from DB settings
async function getAIModel() {
  const apiKey = await getSetting(SETTING_KEYS.openrouter_api_key);
  const modelName = await getSetting(SETTING_KEYS.openrouter_model);
  if (!apiKey || !modelName) throw new Error("OpenRouter not configured");

  const openrouter = createOpenRouter({ apiKey });
  return openrouter(modelName);
}

// Schema for analysis response
const analysisResponseSchema = z.object({
  articles: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    action: z.enum(["create", "update"]),
    content_markdown: z.string(),
    technical_view_markdown: z.string(),
    change_summary: z.string(),
    related_files: z.array(z.string()),
    related_db_tables: z.array(z.object({
      table_name: z.string(),
      columns: z.record(z.string()).nullable(),
      relevance: z.string(),
    })),
    category_suggestion: z.string(),
    conflicts_with_human_edits: z.array(z.string()),
  })),
  summary: z.string(),
});

// Usage
const { output } = await generateText({
  model: await getAIModel(),
  output: Output.object({ schema: analysisResponseSchema }),
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});
```

### Pattern 2: Three-Way Merge on Markdown
**What:** When AI updates a human-edited article, compute human edits as a diff from the last AI version, then three-way merge the new AI content with the human edits.
**When to use:** Any article where `has_human_edits = true`.
**Example:**
```typescript
// Source: node-diff3 README + test cases
import { merge } from "node-diff3";

interface MergeResult {
  content: string;
  hasConflicts: boolean;
}

function threeWayMerge(
  lastAiVersion: string,   // "original" (o) - last AI-generated content
  currentContent: string,   // "ours" (a) - current article with human edits
  newAiContent: string      // "theirs" (b) - new AI-generated content
): MergeResult {
  // Split on newlines for line-based merge
  const o = lastAiVersion.split("\n");
  const a = currentContent.split("\n");
  const b = newAiContent.split("\n");

  const result = merge(a, o, b, {
    stringSeparator: /\n/,
    excludeFalseConflicts: true,
  });

  return {
    content: result.result.join("\n"),
    hasConflicts: result.conflict,
  };
}
```

### Pattern 3: Pipeline Orchestration (Sync -> Analyze -> Generate -> Merge -> Store)
**What:** After a sync completes, the pipeline fetches file contents, sends to AI for analysis, generates/updates articles, and handles merging.
**When to use:** Every sync completion.
**Example:**
```typescript
// Conceptual pipeline flow
async function runAIPipeline(syncLogId: string, changeSet: ChangeSet) {
  // 1. Fetch file contents for changed files from GitHub
  const fileContents = await fetchFileContents(changeSet);

  // 2. Build context: existing categories + article index
  const categories = await getFullCategoryTree();
  const articleIndex = await getArticleIndex();

  // 3. Send to AI for analysis (which articles to create/update)
  const analysisPrompt = await getSetting(SETTING_KEYS.analysis_prompt);
  const stylePrompt = await getSetting(SETTING_KEYS.article_style_prompt);
  const plan = await analyzeChanges(fileContents, categories, articleIndex, analysisPrompt, stylePrompt);

  // 4. For each article in the plan:
  for (const articlePlan of plan.articles) {
    if (articlePlan.action === "create") {
      await createArticle(articlePlan);
    } else {
      await updateArticle(articlePlan); // includes merge logic
    }
  }

  // 5. Update sync_logs with article stats
  await updateSyncStats(syncLogId, plan);
}
```

### Pattern 4: File Content Fetching with Size Awareness
**What:** Fetch actual file content from GitHub using Octokit, respecting the 1MB API limit.
**When to use:** Before sending code to AI for analysis.
**Example:**
```typescript
// Source: Octokit docs + GitHub API docs
import { getOctokit, getRepoConfig } from "@/lib/github/client";

async function fetchFileContent(filePath: string): Promise<string | null> {
  const octokit = await getOctokit();
  const config = await getRepoConfig();

  try {
    const { data } = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: filePath,
      ref: config.branch,
    });

    // getContent returns different shapes for files vs directories
    if (Array.isArray(data) || data.type !== "file") return null;

    // Files up to 1MB are returned with base64 content
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch (error: unknown) {
    // 404 = file deleted, skip it
    if (error && typeof error === "object" && "status" in error) {
      if ((error as { status: number }).status === 404) return null;
    }
    throw error;
  }
}
```

### Anti-Patterns to Avoid
- **Sending all changed files in one LLM call:** Context window limits will be exceeded for large syncs. Batch files into logical groups (by directory/module) and process in chunks.
- **Using AI for merge resolution:** The three-way merge must be deterministic. AI-based merge can silently drop human content. Use `node-diff3` for structural merge, AI only for conflict *flagging*.
- **Storing Markdown as the source of truth:** BlockNote JSON is the source of truth (per project decision). Markdown is a derived, lossy format used only for AI processing and diffs. Always convert back to BlockNote JSON for storage.
- **Regenerating all articles on every sync:** Only process articles affected by changed files. Use the analysis step to determine which articles need updates.
- **Ignoring the category tree in prompts:** Per project decision, AI MUST receive the full category tree and article index. Omitting this leads to category proliferation and poor wiki organization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from LLM | Custom JSON parsing/validation | Vercel AI SDK `Output.object()` with Zod schema | Handles retries on malformed JSON, type validation, error recovery |
| Three-way text merge | Custom diff algorithm | `node-diff3` `merge()` | Diff3 is a complex algorithm with subtle edge cases (false conflicts, whitespace handling, boundary detection). 30+ years of refinement in GNU diffutils |
| Unified diff generation | Manual line-by-line comparison | `diff` package `createPatch()` | Standard unified diff format, handles context lines, escape sequences |
| BlockNote JSON <-> Markdown | Custom parser/serializer | `@blocknote/server-util` `ServerBlockNoteEditor` | Exact parity with the client-side editor's format. Custom parsers will drift |
| LLM retry/error handling | Custom fetch wrapper with retry | Vercel AI SDK built-in retry/error handling | Handles rate limits, malformed responses, token tracking, abort signals |
| JSON schema enforcement for LLM | Prompt engineering with "respond in JSON" | AI SDK structured output with `response_format: json_schema` | Model-level JSON schema enforcement is more reliable than prompt instructions |

**Key insight:** The AI pipeline combines multiple complex domains (LLM interaction, text merging, format conversion). Each domain has mature, purpose-built libraries. Hand-rolling any of them risks subtle bugs that are hard to reproduce and debug.

## Common Pitfalls

### Pitfall 1: Context Window Overflow
**What goes wrong:** Sending too many files or too much content in a single LLM call causes token limit errors or degraded quality (models perform worse with very long contexts).
**Why it happens:** A monolith repo can have hundreds of changed files in a sync. Each file may be 1-50KB of code.
**How to avoid:** Batch files into groups of ~20-30 files or ~50K tokens per LLM call. Process batches sequentially. Include file paths in the prompt so the AI knows what it is looking at even without seeing every file.
**Warning signs:** LLM returning truncated or empty responses, 400 errors from OpenRouter, incoherent article content.

### Pitfall 2: Lossy Markdown Round-Trip
**What goes wrong:** Converting BlockNote JSON -> Markdown -> AI processing -> Markdown -> BlockNote JSON loses formatting, custom blocks, or structural information.
**Why it happens:** Markdown is a lossy format. BlockNote has block types and attributes that don't map 1:1 to Markdown.
**How to avoid:** Accept that AI-generated content starts as Markdown and gets converted to BlockNote JSON (one-way for new articles). For updates, work on the Markdown representation for merge, then convert the merged result back. Document which BlockNote features may be affected. For human-edited articles, the merge operates on Markdown derived from the *stored* BlockNote JSON, so the round-trip is: JSON -> MD (for merge) -> merged MD -> JSON (for storage).
**Warning signs:** Articles losing inline styles, images, or custom blocks after AI updates.

### Pitfall 3: False Conflicts in Three-Way Merge
**What goes wrong:** The merge reports conflicts when both AI and human made the same change (e.g., both fixed a typo), or when changes are in completely separate sections but touch adjacent lines.
**Why it happens:** Line-based diff algorithms can be overly sensitive.
**How to avoid:** Use `node-diff3`'s `excludeFalseConflicts: true` option. Consider post-processing conflicts to check if the conflicting content is semantically equivalent.
**Warning signs:** High conflict rate when most changes should merge cleanly.

### Pitfall 4: GitHub API Rate Limits During Content Fetch
**What goes wrong:** Fetching content for hundreds of files individually exhausts the GitHub API rate limit (5000 requests/hour for authenticated requests).
**Why it happens:** Each `repos.getContent()` call is one API request. A large sync with 200 changed files = 200 API calls.
**How to avoid:** Use batch fetching strategies: (a) for initial imports, consider fetching a tarball/zipball instead of individual files; (b) for incremental syncs, only fetch content for files that actually changed (use the changeset from Phase 2); (c) add rate limit awareness with exponential backoff (reuse Phase 2's `withRetry` pattern).
**Warning signs:** 403 rate limit errors, sync taking >10 minutes.

### Pitfall 5: Category Proliferation
**What goes wrong:** AI creates many new categories instead of using existing ones, fragmenting the wiki navigation.
**Why it happens:** AI doesn't have enough context about existing categories or the prompt doesn't strongly enough emphasize reuse.
**How to avoid:** Per project decision, always include the full category tree and article index in the AI prompt. Add explicit instructions: "You MUST use an existing category unless no existing category fits. Creating a new category requires justification."
**Warning signs:** Category count growing rapidly after each sync, many categories with only 1-2 articles.

### Pitfall 6: Race Condition Between Sync and AI Pipeline
**What goes wrong:** A new sync starts while the AI pipeline from the previous sync is still running, leading to inconsistent state.
**Why it happens:** The sync lock (Phase 2) releases when file metadata is written, but AI processing continues.
**How to avoid:** Extend the sync lock to cover the full pipeline (sync + AI processing), OR use a separate AI processing lock. The simplest approach: keep the sync_logs entry in "running" status until AI processing completes.
**Warning signs:** Duplicate articles, articles referencing outdated file versions.

### Pitfall 7: Stale needsReview Flag
**What goes wrong:** The `needs_review` flag is set on an article but never cleared, causing permanent review banners.
**Why it happens:** No clear mechanism for dismissal, or dismissal endpoint not implemented.
**How to avoid:** Implement a simple API endpoint/server action to clear `needs_review` on an article. This is AIPL-08 in the requirements.
**Warning signs:** All human-edited articles permanently showing review banners.

## Code Examples

### Creating the OpenRouter AI Client
```typescript
// src/lib/ai/client.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

export async function getAIModel() {
  const apiKey = await getSetting(SETTING_KEYS.openrouter_api_key);
  const modelName = await getSetting(SETTING_KEYS.openrouter_model);

  if (!apiKey) throw new Error("OpenRouter API key not configured");
  if (!modelName) throw new Error("OpenRouter model not configured");

  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://codewiki.internal",
      "X-Title": "CodeWiki",
    },
  });

  return openrouter(modelName);
}
```

### Analysis Prompt Construction
```typescript
// src/lib/ai/prompts.ts
interface PromptContext {
  changedFiles: Array<{ path: string; content: string }>;
  existingCategories: Array<{ id: string; name: string; slug: string; parentName?: string }>;
  existingArticles: Array<{ slug: string; title: string; categoryName: string; hasHumanEdits: boolean }>;
  analysisPrompt: string;
  articleStylePrompt: string;
}

export function buildAnalysisPrompt(ctx: PromptContext): string {
  const categoryTree = ctx.existingCategories
    .map(c => `- ${c.parentName ? `${c.parentName} > ` : ""}${c.name} (slug: ${c.slug})`)
    .join("\n");

  const articleIndex = ctx.existingArticles
    .map(a => `- [${a.categoryName}] "${a.title}" (slug: ${a.slug})${a.hasHumanEdits ? " [HUMAN-EDITED]" : ""}`)
    .join("\n");

  const filesSummary = ctx.changedFiles
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  return `${ctx.analysisPrompt}

## Existing Category Tree
${categoryTree || "(No categories yet)"}

## Existing Articles Index
${articleIndex || "(No articles yet)"}

## Article Writing Style
${ctx.articleStylePrompt}

## Changed Files
${filesSummary}`;
}
```

### Three-Way Merge Implementation
```typescript
// src/lib/merge/three-way.ts
import { merge as diff3Merge } from "node-diff3";

export interface MergeResult {
  mergedMarkdown: string;
  hasConflicts: boolean;
  conflictCount: number;
}

/**
 * Three-way merge for article content.
 *
 * @param base     - Last AI-generated version (the common ancestor)
 * @param current  - Current article content (includes human edits)
 * @param incoming - New AI-generated content
 */
export function mergeArticleContent(
  base: string,
  current: string,
  incoming: string
): MergeResult {
  const result = diff3Merge(
    current.split("\n"),   // "ours" - human-edited version
    base.split("\n"),       // "original" - last AI version
    incoming.split("\n"),   // "theirs" - new AI version
    { excludeFalseConflicts: true }
  );

  // Count conflicts (lines containing conflict markers)
  const conflictMarkers = result.result.filter(
    (line: string) => line === "<<<<<<< a" || line === "=======" || line === ">>>>>>> b"
  );
  const conflictCount = Math.floor(conflictMarkers.length / 3);

  return {
    mergedMarkdown: result.result.join("\n"),
    hasConflicts: result.conflict,
    conflictCount,
  };
}
```

### BlockNote JSON <-> Markdown Conversion
```typescript
// src/lib/content/markdown.ts
import { ServerBlockNoteEditor } from "@blocknote/server-util";

let editorInstance: Awaited<ReturnType<typeof ServerBlockNoteEditor.create>> | null = null;

async function getServerEditor() {
  if (!editorInstance) {
    editorInstance = ServerBlockNoteEditor.create();
  }
  return editorInstance;
}

/**
 * Convert BlockNote JSON blocks to Markdown for AI processing.
 * This is a LOSSY conversion -- some block types may lose attributes.
 */
export async function blocksToMarkdown(blocksJson: unknown): Promise<string> {
  const editor = await getServerEditor();
  const blocks = blocksJson as any[]; // BlockNote Block[]
  return await editor.blocksToMarkdownLossy(blocks);
}

/**
 * Convert Markdown (from AI or merge) to BlockNote JSON blocks for storage.
 */
export async function markdownToBlocks(markdown: string): Promise<unknown[]> {
  const editor = await getServerEditor();
  return await editor.tryParseMarkdownToBlocks(markdown);
}
```

### Unified Diff Generation for Version History
```typescript
// src/lib/merge/diff.ts
import { createPatch } from "diff";

/**
 * Generate a unified diff between two versions of article content.
 * Stored in article_versions.diff_from_previous for quick display.
 */
export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  articleSlug: string
): string {
  return createPatch(
    articleSlug,
    oldContent,
    newContent,
    "previous version",
    "current version",
    { context: 3 }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject()` in Vercel AI SDK | `generateText()` with `Output.object()` | AI SDK v6 (2025-2026) | `generateObject` is deprecated; use `generateText` + `output` property |
| Direct fetch to OpenRouter API | `@openrouter/ai-sdk-provider` v2 | 2025 | Type-safe, integrated with AI SDK ecosystem, structured outputs |
| `@openrouter/sdk` (official beta) | `@openrouter/ai-sdk-provider` | Ongoing | Official SDK is ESM-only beta with breaking changes; AI SDK provider is more stable for production |
| Zod v3 for AI schemas | Zod v4 supported in AI SDK v6 | 2025-2026 | May need `zodSchema()` wrapper if direct v4 usage has issues |
| Manual JSON parsing of LLM output | `Output.object()` with Zod validation | AI SDK v6 | Automatic JSON schema enforcement, retry on malformed responses |

**Deprecated/outdated:**
- `generateObject()` / `streamObject()`: Deprecated in AI SDK v6. Use `generateText()` / `streamText()` with `output` property instead.
- Direct `fetch()` to `https://openrouter.ai/api/v1/chat/completions`: Works but lacks type safety, retry logic, structured output enforcement. Use AI SDK provider instead.
- `response_format: { type: "json_object" }`: Basic JSON mode. Prefer `Output.object()` with Zod schema for strict validation.

## Open Questions

1. **Token budgeting per LLM call**
   - What we know: Models have context windows (128K-200K tokens for modern models). File content can be large. The AI SDK will throw if the context is exceeded.
   - What's unclear: Exact token budget strategy -- how many files per batch, whether to truncate large files, whether to use a cheaper model for analysis vs. a more capable one for generation.
   - Recommendation: Start with a conservative batch size (~30 files or ~50K tokens of code per call). Measure actual token usage in early testing and adjust. Consider a two-pass approach: analysis pass (cheaper model, more files) then generation pass (better model, focused context).

2. **Conflict marker handling in merged content**
   - What we know: `node-diff3` `merge()` inserts standard `<<<<<<<`/`=======`/`>>>>>>>` conflict markers into the result.
   - What's unclear: Should conflict markers be stored in the article content, or should conflicts be stored separately? How does BlockNote JSON handle conflict markers in Markdown?
   - Recommendation: Do NOT store conflict markers in article content. When `merge()` reports `conflict: true`, keep the *current* (human-edited) version as the article content, store the AI's proposed changes in the version history with `change_source: "ai_merged"`, and set `needs_review: true`. This preserves human work and lets the user resolve conflicts manually.

3. **Content hash for github_files**
   - What we know: The schema has a `content_hash` column on `github_files` (added in Phase 1 schema). Phase 2 only stores SHA metadata.
   - What's unclear: Whether to populate `content_hash` during Phase 3 content fetching, and what hash algorithm to use.
   - Recommendation: Populate `content_hash` with a SHA-256 of the file content when fetching. This enables future optimization: skip re-analysis if content hasn't semantically changed (the git SHA changes on any commit, even if file content is identical due to merge commits).

4. **Handling the "New Files Review" admin section**
   - What we know: Per project decision, new repo files surface in a "New Files Review" admin section rather than being auto-included. Admin includes or ignores each, then "Apply Updates" triggers AI import.
   - What's unclear: Whether this UI is part of Phase 3 or a later phase. The current sync/file-tree UI from Phase 2 already has inclusion/exclusion checkboxes.
   - Recommendation: The existing Phase 2 file tree with inclusion checkboxes likely covers this. Phase 3 should focus on the AI pipeline that processes *included* files. If a dedicated "New Files Review" UI is needed, it can be a separate sub-plan or deferred.

## Sources

### Primary (HIGH confidence)
- [Vercel AI SDK v6 docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - Structured output with `generateText` + `Output.object()`, deprecation of `generateObject`
- [OpenRouter AI SDK Provider README](https://github.com/OpenRouterTeam/ai-sdk-provider) - Installation, structured output examples, streaming, Anthropic features
- [node-diff3 README and tests](https://github.com/bhousel/node-diff3) - Three-way merge API, `merge()` function, conflict representation, `stringSeparator` option
- [BlockNote server-util docs](https://www.blocknotejs.org/docs/editor-api/server-processing) - `ServerBlockNoteEditor.create()`, `blocksToMarkdownLossy()`, `tryParseMarkdownToBlocks()`
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart) - API endpoint, required headers, authentication
- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs) - `response_format` with `json_schema` mode

### Secondary (MEDIUM confidence)
- [GitHub API file size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) - 1MB limit for `repos.getContent()`, Git Blobs API for 1-100MB
- [AI SDK Zod v4 support](https://github.com/vercel/ai/discussions/7289) - AI SDK v6 supports Zod v3 and v4
- [diff npm package](https://www.npmjs.com/package/diff) - `createPatch()`, `structuredPatch()` for unified diffs

### Tertiary (LOW confidence)
- Token budgeting strategy for large codebases - based on general LLM best practices, not project-specific testing. Needs validation with actual repo data.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and READMEs. Version numbers confirmed from npm.
- Architecture: HIGH - Pipeline pattern follows the spec's defined flow (sections 6 and 7). Three-way merge strategy explicitly described in spec.
- Pitfalls: HIGH for known issues (context overflow, rate limits, lossy conversion), MEDIUM for edge cases (conflict resolution UX, token budgeting).

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days -- AI SDK ecosystem moves fast, check for breaking changes)
