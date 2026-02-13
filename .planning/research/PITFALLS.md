# Pitfalls Research

**Domain:** AI-augmented internal wiki with automated code-to-documentation pipeline
**Researched:** 2026-02-13
**Confidence:** HIGH (verified across official docs, GitHub issues, and multiple sources)

## Critical Pitfalls

### Pitfall 1: BlockNote Markdown Round-Trip Is Lossy by Design

**What goes wrong:**
The spec mandates "all content stored as raw Markdown" and uses BlockNote as the WYSIWYG editor. BlockNote's markdown export function is explicitly named `blocksToMarkdownLossy()` because it discards information. Children of blocks that are not list items get un-nested, certain styles are removed, and BlockNote-specific features like nested block hierarchies are flattened. This means: a user edits an article in BlockNote, saves (Markdown is stored), reopens to edit again (Markdown is parsed back into BlockNote blocks), and the content has silently degraded. Repeated edit cycles compound the loss.

**Why it happens:**
BlockNote uses a Notion-style block model internally (ProseMirror/TipTap). Markdown is a serialization format, not its native representation. The official docs explicitly recommend using `JSON.stringify(editor.document)` (BlockNote JSON) for lossless storage. The project spec chose Markdown-native storage, which directly conflicts with BlockNote's design assumptions.

**How to avoid:**
1. **Store BlockNote JSON as the source of truth** alongside Markdown. Add a `content_json` column to `articles`. Use BlockNote JSON for editor round-trips; generate Markdown from it for rendering, AI consumption, and version diffs.
2. **Alternatively, evaluate Milkdown early** -- the spec already identifies it as a fallback. Milkdown is ProseMirror-based but Markdown-native, meaning its internal model maps directly to Markdown. Run a fidelity test with representative content (tables, nested lists, code blocks, bold/italic combinations, links) in the first week of Phase 5.
3. **Never rely on Markdown-to-BlockNote-to-Markdown round-trips** for content that must remain identical. If storing only Markdown, always render from stored Markdown, never from a re-serialized editor state.

**Warning signs:**
- Mysterious formatting changes appearing in version diffs that no human made
- Tables or nested lists losing structure after being opened in the editor but not modified
- Users reporting "my edits keep getting changed" when they did not save

**Phase to address:** Phase 5 (Article Editing) -- but the storage decision (JSON vs Markdown-only) must be made in Phase 1 (Database Schema) since it affects the `articles` table. Prototype the editor round-trip in a spike before finalizing the schema.

**Confidence:** HIGH -- verified via official BlockNote documentation at blocknotejs.org/docs/features/export/markdown

---

### Pitfall 2: pgboss Connection Termination on Neon Auto-Suspend

**What goes wrong:**
pgboss maintains long-lived Postgres connections for its supervisor (polling for jobs). Neon Postgres auto-suspends idle computes after 5 minutes on Free tier (configurable on paid plans). When Neon suspends, it severs all TCP connections without warning. pgboss crashes with "Connection terminated unexpectedly" errors. Since pgboss is the backbone of the sync pipeline (GitHub sync, AI article generation), a crashed pgboss means scheduled syncs silently stop running.

**Why it happens:**
pgboss was designed for always-on Postgres instances. Neon's serverless model assumes connections are ephemeral. The two assumptions are fundamentally at odds. The project runs pgboss inside a Docker container (long-running process) talking to a remote Neon database (auto-suspending serverless).

**How to avoid:**
1. **Disable Neon auto-suspend** for the production compute endpoint. On paid plans, set the suspend timeout to "never" or to a duration longer than the longest gap between sync jobs. This is the simplest and most reliable fix.
2. **Enable TCP keep-alive** on the pgboss connection: `{ connectionOptions: { keepAlive: true, keepAliveInitialDelay: 30000 } }`. This sends periodic packets that prevent Neon from treating the connection as idle.
3. **Use Neon's connection pooler endpoint** (PgBouncer in transaction mode) for pgboss, which handles connection lifecycle transparently.
4. **Implement `boss.on('error', ...)`** with automatic restart logic. If the connection drops, detect it and re-initialize pgboss rather than crashing the entire application.
5. **Use the globalThis singleton pattern** for the pgboss instance in the Next.js process to prevent multiple instances during development hot reload: `globalThis.__pgboss = globalThis.__pgboss || new PgBoss(config)`.

**Warning signs:**
- Sync jobs stop running with no error visible in the UI
- `sync_logs` table shows no new entries after the first few days
- Application logs show "Connection terminated unexpectedly" from pg-boss
- pgboss maintenance tasks (cleanup, archiving) stop executing

**Phase to address:** Phase 2 (GitHub Integration) -- pgboss setup is the core of this phase. The connection resilience must be designed from the start, not bolted on.

**Confidence:** HIGH -- verified via pgboss GitHub Issue #381, pgboss Discussion #403, and Neon's official blog post on auto-suspend with long-running applications

---

### Pitfall 3: AI Content Merge Silently Destroys Human Edits

**What goes wrong:**
The spec's merge strategy (Section 7) relies on the AI correctly merging its new content with human edits by following instructions in the prompt. LLMs are unreliable executors of precise merge operations. The AI may: (a) silently drop human-added sections it considers redundant, (b) rephrase human-authored text into AI-style prose, losing the human's specific intent, (c) hallucinate that a conflict exists when it does not, or (d) fail to detect an actual conflict. The spec's conflict banner only triggers when the AI self-reports a conflict -- but the AI is the one most likely to miss them.

**Why it happens:**
The merge is delegated to an LLM as a creative task ("merge these, preserving human edits"). LLMs optimize for coherent output, not preservation of exact text. They have no concept of "this paragraph was written by a human and must be kept verbatim." The three-way merge (previous AI version, current content with human edits, new AI content) is a well-known hard problem even in deterministic version control systems -- asking a probabilistic model to do it reliably is high-risk.

**How to avoid:**
1. **Implement deterministic section-level merge before AI involvement.** Parse both the human-edited content and new AI content into sections (by heading). Use a deterministic diff algorithm to identify which sections were human-modified, which are AI-only, and where conflicts exist. Only send actual conflict sections to the AI for resolution.
2. **Use structural markers.** Tag human-edited sections with invisible markers (HTML comments like `<!-- human-edited -->`) so the system can programmatically identify and protect them, independent of AI interpretation.
3. **Never let AI merge be the sole arbiter.** Always generate a diff between the pre-merge and post-merge content. If the diff shows deletions of human-authored content, flag the merge for human review automatically -- do not rely on the AI's self-reported conflict list.
4. **Store the "last AI version" reliably.** The spec already calls for this via `article_versions` with `change_source`. Make sure querying "most recent AI version" is efficient and correct even after multiple human edits and rollbacks.
5. **Add a "protected sections" feature.** Let users mark sections as "do not modify by AI" -- these sections are excluded from the merge entirely and appended unchanged.

**Warning signs:**
- Users stop trusting AI updates and start avoiding human edits
- Version history shows human content disappearing in `ai_merged` versions
- Conflict banners never appear (suggests the AI is not detecting conflicts, not that there are none)
- Articles slowly converge to AI-only prose style despite human edits

**Phase to address:** Phase 3 (AI Processing Pipeline) -- but the merge strategy design should be validated with a prototype before building the full pipeline. Use real article content and simulate several merge cycles to test preservation fidelity.

**Confidence:** HIGH -- based on Wikipedia's documented experience with AI content, hallucination research, and the fundamental probabilistic nature of LLM outputs

---

### Pitfall 4: AI Article Generation Returns Malformed or Schema-Violating JSON

**What goes wrong:**
The analysis prompt (Section 6) asks the AI to respond in a specific JSON format with fields like `slug`, `title`, `action`, `content_markdown`, `related_files`, etc. LLMs frequently produce: (a) JSON with trailing commas, unescaped characters, or missing brackets, (b) valid JSON that does not match the expected schema (missing fields, wrong types, extra fields), (c) JSON wrapped in markdown code fences (` ```json ... ``` `), (d) partial JSON when the response is truncated due to token limits. OpenRouter's Response Healing feature fixes syntax errors but explicitly does not fix schema violations and only works on non-streaming requests.

**Why it happens:**
The response is a large, structured JSON blob potentially containing multiple articles with full Markdown content embedded as JSON string values. Markdown content contains characters that need JSON escaping (backslashes, quotes, newlines). As content size grows, the probability of malformation increases. Token limits can truncate the response mid-JSON.

**How to avoid:**
1. **Enable OpenRouter's Response Healing** (adds <1ms latency) to catch syntax errors automatically.
2. **Use OpenRouter's structured output feature** (`response_format: { type: "json_schema", json_schema: { ... } }`) to constrain model output to a predefined schema. This is supported for compatible models and dramatically reduces schema violations.
3. **Implement robust JSON parsing with fallback.** First try `JSON.parse()`. On failure, strip markdown fences, attempt repair (close brackets, remove trailing commas), try again. Use a library like `json-repair` for automatic fixing.
4. **Validate against a Zod schema** after parsing. Reject and retry (up to 2 times) if required fields are missing or types are wrong.
5. **Process articles one at a time** for large changesets instead of asking for all articles in a single response. This reduces response size and truncation risk.
6. **Set appropriate `max_tokens`** to avoid truncation. For a response containing multiple articles, 8000-16000 tokens may be needed. Monitor actual usage.

**Warning signs:**
- Sync jobs completing "successfully" but creating zero articles
- Error logs showing JSON parse failures during sync
- Articles created with empty content or missing titles
- Sync processing time growing disproportionately to changeset size (retry loops)

**Phase to address:** Phase 3 (AI Processing Pipeline) -- JSON parsing resilience is foundational to the entire AI pipeline. Build it from day one, not as error handling added later.

**Confidence:** HIGH -- verified via OpenRouter's official documentation on Response Healing and Structured Outputs

---

### Pitfall 5: Large Codebase Exceeds AI Context Window During Analysis

**What goes wrong:**
The analysis prompt sends changed files plus existing articles index to the AI. For a large monolith, a weekly sync might produce hundreds of changed files totaling hundreds of thousands of tokens. Even models with 200K context windows suffer from "lost in the middle" -- research from Stanford/UC Berkeley shows model accuracy drops significantly around 32K tokens as information buried in the middle gets ignored. The AI either misses changed files, fails to map changes to correct articles, or produces incomplete analysis.

**Why it happens:**
The spec does not define a chunking or batching strategy. The Open Questions section (item 2) acknowledges this risk but defers the solution. A monolith codebase with 500+ files changing per sync will blow past any context window.

**How to avoid:**
1. **Implement file-group batching.** Instead of one massive prompt, group changed files by directory/module (e.g., all files under `src/auth/`, all files under `src/billing/`). Process each group independently, then merge results.
2. **Use a two-pass analysis.** Pass 1: Send file paths and brief summaries (first 20 lines of each file) to identify which articles are affected. Pass 2: For each affected article, send only the relevant files at full content.
3. **Track file-to-article mappings** (already in `article_file_links`). When files change, only analyze them in the context of their previously-linked articles, not all articles.
4. **Set a hard token budget per prompt.** Count tokens before sending (use `tiktoken` or a similar library). If over budget, split into batches.
5. **Implement progressive summarization.** For files that are too large (>500 lines), send a summary or key sections rather than full content.

**Warning signs:**
- AI analysis producing fewer articles than expected for large changesets
- Articles about Module A getting changes intended for Module B (cross-contamination)
- Sync time scaling super-linearly with changeset size
- OpenRouter billing showing unexpectedly high token counts

**Phase to address:** Phase 3 (AI Processing Pipeline) -- the batching strategy must be designed alongside the prompt template system, not retrofitted.

**Confidence:** MEDIUM -- the "lost in the middle" research is well-documented, but the exact threshold depends on the chosen model and the specific codebase characteristics. Needs empirical testing with the target repository.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store only Markdown, no BlockNote JSON | Simpler schema, one source of truth | Editor round-trip degradation, data loss over repeated edits | Never if using BlockNote; acceptable only with a Markdown-native editor like Milkdown |
| Full article content in every `article_versions` row | Simple rollback, no reconstruction needed | Database storage grows linearly with edit frequency; a 10KB article edited 100 times = 1MB for one article | MVP -- but add compression or deduplication by Phase 10 (production readiness) |
| Single pgboss instance without health monitoring | Faster initial setup | Silent failure when connection drops; syncs stop without anyone knowing | Never -- add health check in Phase 2 |
| Hardcoded prompt templates instead of site_settings | Faster iteration during development | Must redeploy to change prompts; loses the admin-editable promise | Phase 3 development only; move to site_settings before Phase 3 completion |
| Skipping optimistic locking on article saves | Simpler save flow | Last-write-wins when two users edit simultaneously, or when AI merge races with human save | Never for a multi-user wiki -- implement in Phase 5 |
| No token counting before AI requests | Simpler API client | Truncated responses, wasted API spend on rejected requests, failed syncs | Phase 3 prototype only; add counting before production sync |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Neon Postgres** | Using standard `pg` driver without connection pooling for the Next.js application (not pgboss). Each API route invocation opens a new connection. | Use `@neondatabase/serverless` with HTTP driver for one-shot queries in API routes. Use Neon's pooler endpoint (PgBouncer) for pgboss and any long-lived connections. Apply the globalThis singleton pattern in development to prevent connection exhaustion during hot reload. |
| **Neon Postgres** | Indexing `search_vector` (tsvector) on raw Markdown that includes formatting syntax (`##`, `**`, `[]()`, etc.). The search index includes Markdown tokens as terms. | Strip Markdown syntax before generating the tsvector. Use a trigger that runs content through a Markdown-to-plaintext function before `to_tsvector()`. Otherwise users searching for "deployment" also get noise from Markdown heading markers. |
| **OpenRouter** | Assuming all models support structured output (`response_format`). Not all models on OpenRouter support JSON mode or schema-constrained output. | Check OpenRouter's model compatibility page. Pin to a specific model known to support structured output (e.g., Claude, GPT-4 family). Fall back to prompt-based JSON with parsing + validation for incompatible models. |
| **OpenRouter** | Not handling streaming SSE in Next.js App Router correctly. The default Node.js runtime has request duration limits on some hosts (10s on Vercel Hobby). | Use `export const runtime = 'edge'` for streaming API routes if deploying to Vercel, or ensure the self-hosted Docker deployment has no gateway timeout. For self-hosted, set `export const maxDuration` if behind a reverse proxy. For the AI article generation pipeline (non-interactive), use non-streaming requests since you need the complete response anyway. |
| **GitHub API (Octokit)** | Fetching entire file tree in a single API call. GitHub's Contents API is limited to 1000 files per directory. Large repos require recursive tree traversal via the Git Trees API. | Use `octokit.rest.git.getTree({ recursive: true })` for the initial import. For incremental syncs, use the Commits API to get changed files by SHA comparison, avoiding full tree re-fetch. |
| **NextAuth.js v5** | Using Google OIDC provider in middleware with Edge runtime. The `oidc-token-hash` package accesses `process.version`, which is unavailable in Edge runtime, causing crashes. | Either skip the OIDC token hash verification in middleware (check only session cookie), or use the Node.js runtime for middleware. The official Auth.js docs address this with a split configuration pattern for Edge compatibility. |
| **NextAuth.js v5** | Changing `NEXTAUTH_SECRET` in production without understanding the consequence. All existing sessions (JWT-based) become invalid instantly, logging out every user. | Document the secret as immutable post-deployment. If rotation is needed, implement a grace period that accepts both old and new secrets. |
| **Docker image storage** | Mounting the entire `.next` directory as a volume. On container rebuild, the old cached pages are served from the volume instead of the new build. | Mount only `/data/images` for image storage. Never mount `.next/` as a persistent volume. Let the build output be ephemeral within the container. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Full-text search on large article corpus without pagination** | Search API returns slowly, browser hangs rendering hundreds of results | Implement cursor-based pagination on search results; limit to 20 results per page with "load more"; use `ts_rank()` to sort by relevance and cut off low-relevance results | 500+ articles |
| **Loading all article versions for diff viewer** | History tab takes seconds to load; memory spikes on client | Paginate version history; load only metadata (version number, date, author, change_source) initially; fetch full content and compute diff only when user selects two versions to compare | 50+ versions per article |
| **Storing full `diff_from_previous` for every version** | `article_versions` table grows at 2x rate (full content + full diff per version) | Compute diffs on-demand instead of storing them. Alternatively, store diffs but use TOAST compression (Postgres does this automatically for large text columns). Monitor table size quarterly. | 1000+ total versions across all articles |
| **GitHub file content stored uncompressed in `github_files.content`** | Database size balloons; Neon storage costs increase | For a monolith with 5000 files, even at avg 5KB/file, that is 25MB raw. Manageable initially. But if the project grows or files are large (generated code, configs), compress content with `pg_lz` or store only file metadata and fetch content on-demand from GitHub when needed. | 10,000+ files or files averaging >50KB |
| **Ask AI conversation history grows unbounded** | `ai_conversation_messages` table becomes the largest table; queries on conversation history slow down | Implement a soft limit (e.g., 50 conversations per user, 100 messages per conversation). Archive or summarize old conversations. Add an index on `(conversation_id, created_at)` -- already specified in schema. | 100+ active users, 6+ months of usage |
| **Image processing blocking the API response** | Image upload feels slow; editor freezes during paste | Process images asynchronously. Return a placeholder URL immediately; process with sharp in a background task (pgboss job or simple async function); update the image record when done. Or accept the synchronous approach but set user expectation with a loading indicator. | Images >2MB original size, or multiple images pasted rapidly |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing OpenRouter API key and GitHub PAT in `site_settings` as plaintext** | Database breach exposes all third-party API credentials. The spec says "DB connection is TLS-encrypted" but at-rest encryption is not mentioned. | Encrypt secret values in `site_settings` using `aes-256-gcm` with a key derived from an environment variable (e.g., `ENCRYPTION_KEY`). Decrypt only at the application layer when needed. Never log decrypted values. |
| **Image serving API route has no access control** | The spec says "No authentication required for image serving" because the server is private. But if the server is accidentally exposed or accessed via VPN by unauthorized users, all article images are publicly accessible. | Add at minimum a session check on the image serving route. Cache aggressively with `Cache-Control` headers so authenticated users rarely hit the API. The cost is minimal for a single-tenant app. |
| **AI prompts in `site_settings` are admin-editable with no validation** | A malicious or careless admin could inject prompts that cause the AI to exfiltrate article content, generate harmful content, or ignore merge rules. | Validate prompt templates (ensure required template variables like `{{changes_summary}}` are present). Log all prompt changes with the admin user ID. Consider a "preview" mode that shows what the prompt would produce on sample data before saving. |
| **GitHub PAT with excessive permissions** | A PAT with write access could be used (if leaked) to modify the source repository. | Document that the PAT should have read-only repo access (`repo:read` scope). Validate and warn in the admin UI if the PAT has write permissions. Prefer GitHub App installation tokens with minimal scopes over PATs. |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **AI-generated articles have no quality indicator** | Users cannot distinguish between a well-grounded AI article and one based on insufficient context (e.g., generated from a single config file). They trust all articles equally. | Show a "confidence" badge based on the number of source files analyzed and the article's age. Articles generated from <3 files get a "draft" badge. Articles that have been human-reviewed get a "verified" badge. |
| **Conflict banner is too easy to dismiss** | The spec says "Any user can dismiss the banner." Once dismissed, the conflict is invisible to other users who have not yet reviewed it. | Make the banner per-user-dismissable (track who dismissed it), not globally dismissable. Or require an explicit "I have reviewed this" action that records the reviewer in the version history. |
| **Editor discards unsaved changes on navigation** | User edits an article, clicks a sidebar link, loses their work. The spec mentions localStorage auto-save but does not specify navigation guards. | Implement `beforeunload` and Next.js route change interception to warn users about unsaved changes. Restore from localStorage auto-save when returning to an edit. |
| **No indication that AI sync is running or has completed** | Users do not know when new/updated articles will appear. They check the wiki and see stale content with no context. | Show a subtle global banner during sync: "Updating articles from latest code changes..." Show a toast notification when sync completes with a summary: "3 articles updated, 1 new article created." |
| **Search does not handle Markdown formatting in results** | Search results show raw Markdown snippets: `## Overview\n\nThe **deployment** module...` instead of rendered or stripped text. | Strip Markdown from search result snippets. Show plain text with the matching term highlighted. Render a brief plain-text excerpt, not the raw stored format. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Article editing:** Editor saves Markdown successfully -- but verify the Markdown round-trips back to the editor without content loss (test with tables, nested lists, images, code blocks)
- [ ] **Version history:** Diff viewer shows changes -- but verify it correctly handles AI-merged versions where both AI and human changes appear in a single version
- [ ] **GitHub sync:** Files download and store correctly -- but verify exclusion rules persist across syncs (new files in excluded directories are not re-included)
- [ ] **AI merge:** Merged content looks correct for the test case -- but verify with edge cases: article with ONLY human edits (no original AI content), article where human deleted an AI section, article where human reordered sections
- [ ] **Full-text search:** Search returns results -- but verify Markdown syntax is stripped from the tsvector index (search for a word that appears only in a heading; should match without requiring `## ` prefix)
- [ ] **Image upload:** Images display in the article -- but verify images survive article version rollback (old version references same image paths), images display correctly when viewing old versions, and orphaned images from deleted content are not prematurely cleaned up
- [ ] **pgboss scheduling:** Cron job triggers correctly -- but verify it recovers after a Neon connection drop, verify only one sync runs at a time under concurrent manual triggers, verify the job dashboard shows accurate status
- [ ] **Ask AI conversation persistence:** Conversations save and load -- but verify that continuing a conversation sends the full message history to the AI (not just the latest message), and verify token limits are respected for long conversations
- [ ] **Notifications:** Slack DM sends successfully -- but verify it handles missing/invalid Slack user IDs gracefully (does not crash the notification pipeline), and verify email notifications degrade gracefully when SendGrid is not configured

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| BlockNote corrupts article content via lossy round-trip | MEDIUM | Rollback to previous version from `article_versions`. Implement BlockNote JSON storage. Re-import Markdown into BlockNote JSON for all existing articles via migration script. |
| pgboss stops running silently | LOW | Restart the application container. pgboss will re-initialize and pick up pending/scheduled jobs. Missed cron jobs will execute on next schedule. No data loss -- job state is in Postgres. |
| AI merge deletes human edits | LOW | Rollback the article to the pre-merge version. The full content is stored per version, so no reconstruction needed. Improve the merge logic or prompt before the next sync. |
| JSON parse failure during sync | LOW | Retry the sync. Failed articles can be individually re-processed. The sync_logs table records which files were processed. Implement per-article retry rather than full-sync retry. |
| Context window overflow produces incomplete analysis | MEDIUM | Re-run the sync with batching enabled. Manually review articles that were generated from the oversized prompt for correctness. No existing data is lost -- incomplete articles can be deleted and regenerated. |
| Neon cold start causes first request to timeout | LOW | Implement retry logic at the application layer. For user-facing requests, show a brief loading state. Consider a health-check endpoint that "warms" the database on container startup. |
| Version history table consumes excessive storage | MEDIUM | Implement a retention policy: keep all versions from the last 90 days, keep one version per week beyond that. Migrate old versions to compressed cold storage. Alternatively, switch from full-content to diff-only storage with on-demand reconstruction. |
| Secrets exposed in site_settings after DB breach | HIGH | Immediately rotate all exposed API keys (OpenRouter, GitHub PAT, SendGrid, Slack bot token). Implement encryption-at-rest for the `value` column. Audit access logs for unauthorized API usage. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| BlockNote Markdown lossy round-trip | Phase 1 (schema decision) + Phase 5 (editor implementation) | Automated test: save Markdown > load in editor > export Markdown > compare. Must be identical for representative content samples. |
| pgboss + Neon connection termination | Phase 2 (pgboss setup) | Integration test: stop and restart the Neon compute; verify pgboss reconnects and resumes jobs within 60 seconds. |
| AI merge destroying human edits | Phase 3 (merge logic) | Test suite with 10+ merge scenarios: human-only edits, section deletion, section reordering, simultaneous human and AI changes, no human edits (pure AI update). |
| Malformed JSON from AI | Phase 3 (AI pipeline) | Unit tests with known-malformed JSON samples (trailing commas, markdown fences, truncated output, missing fields). Pipeline must handle all gracefully. |
| Context window overflow | Phase 3 (AI pipeline) | Load test with a simulated 500-file changeset. Verify batching kicks in and all files are analyzed. Compare results against a manual review. |
| NextAuth.js Edge runtime crash | Phase 1 (authentication) | Deploy to production-like environment and verify middleware executes without process.version errors. |
| tsvector indexing Markdown syntax | Phase 4 (search) | Search for a term that appears only inside a Markdown heading or bold text. Verify it matches without Markdown syntax in the query. |
| Version history storage growth | Phase 10 (production readiness) | Monitor `article_versions` table size after 3 months of usage. Set an alert at 1GB. |
| Image storage and Docker volumes | Phase 1 (Docker setup) + Phase 5 (image handling) | Rebuild Docker container; verify images persisted on volume are still accessible. Verify `.next/` cache is NOT persisted across rebuilds. |
| Secrets stored as plaintext | Phase 2 (admin settings) | Verify secret values are encrypted in the database. Query `site_settings` directly and confirm values are not human-readable. |
| Conflict banner globally dismissable | Phase 3 (review banner) | Two users view the same conflicted article. User A dismisses. User B should still see the banner. |
| Unsaved changes lost on navigation | Phase 5 (editor) | Start editing, attempt to navigate away via sidebar link. Verify browser warning appears. Return to editor and verify content is preserved. |

## Sources

- [BlockNote Markdown Export Documentation](https://www.blocknotejs.org/docs/features/export/markdown) -- official docs confirming lossy export
- [BlockNote Format Interoperability](https://www.blocknotejs.org/docs/foundations/supported-formats) -- official docs on supported formats
- [pgboss Issue #381: Connection terminated unexpectedly](https://github.com/timgit/pg-boss/issues/381) -- community report of serverless DB connection drops
- [pgboss Discussion #403: Usage in serverless environment](https://github.com/timgit/pg-boss/discussions/403) -- official guidance on noSupervisor mode
- [Neon: Connection latency and timeouts](https://neon.com/docs/connect/connection-latency) -- official docs on cold start mitigation
- [Neon: Using auto-suspend with long-running applications](https://neon.com/blog/using-neons-auto-suspend-with-long-running-applications) -- official blog on connection pooling strategy
- [Neon: Connection pooling](https://neon.com/docs/connect/connection-pooling) -- PgBouncer in transaction mode
- [OpenRouter: Response Healing](https://openrouter.ai/docs/guides/features/plugins/response-healing) -- JSON repair for malformed output
- [OpenRouter: Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs) -- schema-constrained JSON responses
- [OpenRouter: Streaming API](https://openrouter.ai/docs/api/reference/streaming) -- SSE timeout behavior
- [Next.js Singleton Discussion #68572](https://github.com/vercel/next.js/discussions/68572) -- globalThis pattern for singletons
- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427) -- streaming issues in API routes
- [Drizzle ORM + Neon Connection Guide](https://orm.drizzle.team/docs/connect-neon) -- HTTP vs WebSocket driver selection
- [Clerk: NextAuth Persistence Issues](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues) -- session management pitfalls
- [Kinde: AI Context Windows Engineering](https://www.kinde.com/learn/ai-for-software-engineering/best-practice/ai-context-windows-engineering-around-token-limits-in-large-codebases/) -- chunking strategies for large codebases
- [Wikipedia AI Content Experience 2025](https://wikiedu.org/blog/2026/01/29/generative-ai-and-wikipedia-editing-what-we-learned-in-2025/) -- lessons from AI-generated wiki content

---
*Pitfalls research for: AI-augmented internal wiki (CodeWiki)*
*Researched: 2026-02-13*
