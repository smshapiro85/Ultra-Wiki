# Phase 2: Admin Settings & GitHub Sync - Research

**Researched:** 2026-02-13
**Domain:** Admin settings management, GitHub API integration, cron scheduling, file tree UI
**Confidence:** HIGH

## Summary

Phase 2 builds the admin configuration dashboard and GitHub repository sync engine. The admin settings portion is straightforward CRUD on a key-value `site_settings` table with secret masking (the table and `isSecret` flag already exist from Phase 1 schema). The GitHub integration uses Octokit to fetch repo file trees, store SHAs for incremental change detection, and sync file content. The cron scheduling uses an API route triggered by an external scheduler (Docker cron or similar) since the project explicitly replaced pgboss with "cron-triggered API route."

A critical architectural constraint is that the project uses the Neon HTTP driver (`@neondatabase/serverless` over HTTP with `drizzle-orm/neon-http`), which is stateless and does **not** support advisory locks or `SELECT ... FOR UPDATE`. Concurrency locking for sync jobs must use an atomic row-status-update pattern on the `sync_logs` table rather than database-level locks. The file tree UI should be a custom recursive component using existing shadcn/ui primitives (checkbox, icons from lucide-react), not a third-party tree library, to maintain consistency with the project's Tailwind/shadcn design system.

**Primary recommendation:** Use `@octokit/rest` for GitHub API, `cronstrue` for human-readable cron previews, `cron-parser` for validation, and implement sync concurrency via atomic status check on `sync_logs` table using Drizzle's `sql` template for a conditional INSERT.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@octokit/rest` | ^22.0.1 | GitHub REST API client | Official GitHub SDK, typed, 100% test coverage, standard for all GitHub integrations |
| `cronstrue` | ^3.9.0 | Cron expression to human-readable text | Zero-dependency, supports 5/6/7 part expressions, i18n, de facto standard |
| `cron-parser` | ^5.x | Cron expression validation and next-occurrence | Validates expressions, computes next run times, timezone support |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` | ^0.45.1 | Database queries for settings/sync_logs/github_files | All DB operations |
| `zod` | ^4.3.6 (via zod/v4) | Server action input validation | Validate admin form inputs |
| `lucide-react` | ^0.564.0 | Icons (folder, file, chevron, lock, etc.) | File tree UI, settings UI icons |
| `radix-ui` | ^1.4.3 | UI primitives (via shadcn) | Tabs, accordion, checkbox for settings/tree |
| `sonner` | ^2.0.7 | Toast notifications | Success/error feedback on settings save |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@octokit/rest` | `octokit` (batteries-included) | `octokit` includes GraphQL, auth strategies, pagination -- heavier than needed; `@octokit/rest` is the focused REST-only client |
| `cronstrue` | Manual regex | cronstrue handles edge cases, Quartz syntax, i18n; not worth hand-rolling |
| Custom tree component | `react-checkbox-tree`, `react-arborist` | Third-party trees bring their own styling, hard to match shadcn/tailwind design; custom recursive component is ~80 lines and fully controlled |
| Status-based concurrency | PostgreSQL advisory locks | Neon HTTP driver is stateless; advisory locks require persistent connections (WebSocket mode) which the project doesn't use |

**Installation:**
```bash
npm install @octokit/rest cronstrue cron-parser
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (admin)/
      admin/
        settings/
          page.tsx              # Admin settings dashboard (tabs layout)
          actions.ts            # Server actions for settings CRUD
          general-settings.tsx  # GitHub repo URL, sync schedule
          api-keys-settings.tsx # OpenRouter, SendGrid, Slack API keys
          ai-prompts-settings.tsx # Four AI prompt textareas
        sync/
          page.tsx              # Sync dashboard (trigger, history, file tree)
          actions.ts            # Server actions for sync operations
          file-tree.tsx         # Interactive file tree with checkboxes
          sync-history.tsx      # Sync log table
          sync-trigger.tsx      # Manual sync button with progress
        users/
          (existing from Phase 1)
    api/
      admin/
        sync/
          route.ts              # POST: trigger manual sync
          cron/
            route.ts            # POST: cron-triggered sync endpoint
        settings/
          test-connection/
            route.ts            # POST: test API key connections
  lib/
    github/
      client.ts                 # Octokit client factory (reads settings from DB)
      tree.ts                   # Fetch and diff file tree logic
      sync.ts                   # Core sync orchestration (fetch changes, store files)
    settings/
      index.ts                  # getSetting/setSetting/getSettings helpers
      constants.ts              # Setting key constants, defaults
```

### Pattern 1: Settings Key-Value Store with Secret Masking
**What:** All admin settings stored in `site_settings` table with `key`, `value`, `isSecret`, `description` columns. Server actions read/write settings; secret values are never sent to the frontend.
**When to use:** Every admin setting (API keys, cron expressions, repo URL, AI prompts).
**Example:**
```typescript
// src/lib/settings/index.ts
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db.select().from(siteSettings)
    .where(eq(siteSettings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function getSettingsForUI(keys: string[]): Promise<Record<string, { value: string; isSecret: boolean }>> {
  const db = getDb();
  const rows = await db.select().from(siteSettings)
    .where(inArray(siteSettings.key, keys));
  const result: Record<string, { value: string; isSecret: boolean }> = {};
  for (const row of rows) {
    result[row.key] = {
      value: row.isSecret ? (row.value ? "********" : "") : row.value,
      isSecret: row.isSecret,
    };
  }
  return result;
}

export async function setSetting(key: string, value: string, isSecret = false): Promise<void> {
  const db = getDb();
  await db.insert(siteSettings)
    .values({ key, value, isSecret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, isSecret, updatedAt: new Date() },
    });
}
```

### Pattern 2: Sync Concurrency Lock via Atomic Status Check
**What:** Before starting a sync, atomically INSERT a new `sync_logs` row with status `running` only if no other row has `running` status. Uses a raw SQL conditional insert since Neon HTTP doesn't support advisory locks.
**When to use:** Every sync operation (manual or scheduled).
**Example:**
```typescript
// Acquire sync lock: only succeeds if no running sync exists
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function acquireSyncLock(triggerType: "manual" | "scheduled"): Promise<string | null> {
  const db = getDb();
  const result = await db.execute(sql`
    INSERT INTO sync_logs (id, status, trigger_type, started_at, created_at)
    SELECT gen_random_uuid(), 'running', ${triggerType}, now(), now()
    WHERE NOT EXISTS (
      SELECT 1 FROM sync_logs WHERE status = 'running'
    )
    RETURNING id
  `);
  // Returns the sync log ID if lock acquired, null if another sync is running
  return result.rows?.[0]?.id as string | null;
}

export async function releaseSyncLock(syncLogId: string, status: "completed" | "failed", stats: SyncStats): Promise<void> {
  const db = getDb();
  await db.update(syncLogs)
    .set({
      status,
      completedAt: new Date(),
      filesProcessed: stats.filesProcessed,
      articlesCreated: stats.articlesCreated,
      articlesUpdated: stats.articlesUpdated,
      errorMessage: stats.error ?? null,
    })
    .where(eq(syncLogs.id, syncLogId));
}
```

### Pattern 3: Cron-Triggered API Route with Secret Auth
**What:** An API route at `/api/admin/sync/cron` accepts POST requests from an external cron scheduler. Protected by a `CRON_SECRET` environment variable checked via Authorization header.
**When to use:** Scheduled sync execution.
**Example:**
```typescript
// src/app/api/admin/sync/cron/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Trigger sync logic (same as manual but with trigger_type "scheduled")
  // ...
  return NextResponse.json({ success: true });
}
```

Docker Compose addition for cron sidecar (or use host cron):
```yaml
# In docker-compose.yml, add cron trigger
# Option A: Host cron with curl
# */30 * * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/admin/sync/cron

# Option B: Docker cron sidecar
cron:
  image: alpine
  command: crond -f
  volumes:
    - ./crontab:/etc/crontabs/root
  depends_on:
    - app
```

### Pattern 4: GitHub Tree Fetching with SHA Comparison
**What:** Fetch the full repo tree from GitHub using `git.getTree` with recursive flag, compare SHAs against stored `github_files` rows to detect changes.
**When to use:** Every sync operation.
**Example:**
```typescript
// src/lib/github/tree.ts
import { Octokit } from "@octokit/rest";

interface TreeFile {
  path: string;
  sha: string;
  size: number;
  type: "blob" | "tree";
}

export async function fetchRepoTree(octokit: Octokit, owner: string, repo: string, branch = "main"): Promise<TreeFile[]> {
  // Get the branch HEAD commit SHA
  const { data: ref } = await octokit.git.getRef({
    owner, repo, ref: `heads/${branch}`,
  });
  const commitSha = ref.object.sha;

  // Get recursive tree
  const { data: tree } = await octokit.git.getTree({
    owner, repo, tree_sha: commitSha, recursive: "true",
  });

  if (tree.truncated) {
    // Tree too large (>100k entries) -- fall back to non-recursive traversal
    // This is unlikely for most repos but should be handled
    console.warn("Tree was truncated; large repo may need paginated tree fetching");
  }

  return tree.tree
    .filter((item): item is TreeFile & { path: string; sha: string } =>
      item.type === "blob" && item.path != null && item.sha != null
    )
    .map(item => ({
      path: item.path!,
      sha: item.sha!,
      size: item.size ?? 0,
      type: item.type as "blob",
    }));
}
```

### Pattern 5: File Exclusion with Pattern Matching
**What:** Exclusion rules stored in `excluded_paths` table as glob-like patterns. Check each file against exclusion patterns before syncing. Directory exclusions apply to all children.
**When to use:** Filtering file tree during sync and in the file tree UI.
**Example:**
```typescript
// src/lib/github/exclusions.ts
export function isPathExcluded(filePath: string, excludedPatterns: string[]): boolean {
  return excludedPatterns.some(pattern => {
    // Direct match
    if (filePath === pattern) return true;
    // Directory prefix match (pattern "src/tests" excludes "src/tests/foo.ts")
    if (filePath.startsWith(pattern + "/")) return true;
    // Parent directory match (pattern "node_modules" excludes "node_modules/foo/bar.js")
    if (pattern.endsWith("/") && filePath.startsWith(pattern)) return true;
    return false;
  });
}
```

### Anti-Patterns to Avoid
- **Sending full secret values to the frontend:** Never return the actual API key value from server actions. Always mask with "********" for display. When saving, check if value is "********" and skip the update (keep existing value).
- **Polling for sync status:** Use server-sent events or periodic revalidation with `router.refresh()` rather than aggressive client-side polling.
- **Fetching file content during tree sync:** Only fetch/store the tree structure (paths and SHAs) during tree sync. File content is fetched on-demand during the AI processing phase (Phase 3). This keeps sync fast and storage light.
- **Using node-cron inside Next.js:** The decision was to use cron-triggered API routes. node-cron requires a custom server.js setup and won't work with `next start` standalone mode.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API calls | Custom fetch wrapper with auth | `@octokit/rest` | Rate limiting, pagination, typed responses, retries, OAuth token handling |
| Cron expression display | Regex-based cron parser | `cronstrue` | 30+ languages, Quartz syntax, edge cases for day-of-week/month |
| Cron expression validation | Manual regex | `cron-parser` | Validates all cron fields, timezone support, computes next occurrence |
| UI components (tabs, inputs) | Custom HTML elements | shadcn/ui (Tabs, Input, Textarea, Card, etc.) | Accessible, consistent with existing app design, keyboard navigation |

**Key insight:** The GitHub API has many edge cases (rate limiting, large trees truncation, base64 encoding, pagination) that Octokit handles transparently. Custom fetch wrappers invariably miss edge cases that surface in production.

## Common Pitfalls

### Pitfall 1: Secret Value Overwrite on Save
**What goes wrong:** Admin opens settings, sees "********" for API key, submits form -- the masked value "********" overwrites the real secret in the database.
**Why it happens:** Naive form handling treats masked display value as the actual value.
**How to avoid:** On the server action, check if the incoming value for a secret field equals the mask string ("********"). If so, skip updating that field. Only update secrets when the user provides a new value (different from the mask).
**Warning signs:** API integrations break after admin visits settings page without changing keys.

### Pitfall 2: Neon HTTP Stateless Limitations
**What goes wrong:** Attempting to use advisory locks, `SELECT FOR UPDATE`, or session-level features fails silently or throws errors with the Neon HTTP driver.
**Why it happens:** The project uses `@neondatabase/serverless` HTTP mode, which is stateless -- each query is an independent HTTP request with no persistent connection.
**How to avoid:** Use atomic INSERT with NOT EXISTS subquery for concurrency locks. Use `db.batch()` (Drizzle's batch API for Neon HTTP) when you need multiple queries in an implicit transaction.
**Warning signs:** Concurrent sync operations creating duplicate entries, lock-related SQL errors.

### Pitfall 3: GitHub Tree Truncation
**What goes wrong:** `git.getTree` with `recursive: "true"` returns `truncated: true` for repos with >100,000 files, meaning the tree is incomplete.
**Why it happens:** GitHub API limit of 100,000 entries / 7MB for recursive tree responses.
**How to avoid:** Check the `truncated` flag. For large repos, fall back to non-recursive tree fetching (traverse directories one at a time). Most internal repos won't hit this limit.
**Warning signs:** Files appearing in GitHub but missing from sync.

### Pitfall 4: Octokit TypeScript getContent Type Narrowing
**What goes wrong:** TypeScript errors when accessing `.content` on `repos.getContent()` response because the type is a union of file/directory/symlink/submodule responses.
**Why it happens:** The return type is a union; TypeScript can't narrow it without explicit checks.
**How to avoid:** Type-guard the response: check `!Array.isArray(data) && data.type === "file"` before accessing `data.content`. Or use `git.getBlob()` with a known SHA instead, which always returns base64 content.
**Warning signs:** TypeScript compilation errors on `data.content` access.

### Pitfall 5: CRON_SECRET Not Set in Development
**What goes wrong:** Cron endpoint rejects all requests during development because CRON_SECRET is undefined.
**Why it happens:** Environment variable not added to `.env` file.
**How to avoid:** Add CRON_SECRET to `.env.example` with a development default. In the cron route handler, log a warning if CRON_SECRET is not set and reject all requests.
**Warning signs:** Scheduled syncs never execute, 401 responses in cron logs.

### Pitfall 6: Excluded Path Race Condition During Sync
**What goes wrong:** Admin modifies exclusion rules while a sync is running, causing inconsistent state.
**Why it happens:** Exclusion rules are read at the start of sync, but the admin UI allows changes during sync.
**How to avoid:** Read exclusion rules once at sync start and use that snapshot for the entire sync operation. The next sync will pick up any changes.
**Warning signs:** Excluded files still appearing in sync results, or newly included files being missed.

## Code Examples

Verified patterns from official sources and project conventions:

### Octokit Client Factory
```typescript
// src/lib/github/client.ts
import { Octokit } from "@octokit/rest";
import { getSetting } from "@/lib/settings";

let _octokit: Octokit | null = null;

export async function getOctokit(): Promise<Octokit> {
  const token = await getSetting("github_api_key");
  if (!token) {
    throw new Error("GitHub API key not configured");
  }
  // Recreate if token may have changed (admin updated it)
  _octokit = new Octokit({ auth: token });
  return _octokit;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const match = url.match(/(?:github\.com\/)?([^\/]+)\/([^\/\s\.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}
```

### Settings Constants
```typescript
// src/lib/settings/constants.ts
export const SETTING_KEYS = {
  GITHUB_REPO_URL: "github_repo_url",
  GITHUB_API_KEY: "github_api_key",
  GITHUB_BRANCH: "github_branch",
  OPENROUTER_API_KEY: "openrouter_api_key",
  OPENROUTER_MODEL: "openrouter_model",
  SENDGRID_API_KEY: "sendgrid_api_key",
  SENDGRID_FROM_EMAIL: "sendgrid_from_email",
  SLACK_BOT_TOKEN: "slack_bot_token",
  SYNC_SCHEDULE: "sync_schedule",
  AI_PROMPT_ANALYSIS: "ai_prompt_analysis",
  AI_PROMPT_ARTICLE_STYLE: "ai_prompt_article_style",
  AI_PROMPT_GLOBAL_ASK: "ai_prompt_global_ask",
  AI_PROMPT_PAGE_ASK: "ai_prompt_page_ask",
} as const;

export const SECRET_KEYS = new Set([
  SETTING_KEYS.GITHUB_API_KEY,
  SETTING_KEYS.OPENROUTER_API_KEY,
  SETTING_KEYS.SENDGRID_API_KEY,
  SETTING_KEYS.SLACK_BOT_TOKEN,
]);

export const MASK_VALUE = "********";
```

### Admin Settings Server Action Pattern
```typescript
// src/app/(admin)/admin/settings/actions.ts (pattern)
"use server";

import { auth } from "@/lib/auth";
import { getSetting, setSetting, getSettingsForUI } from "@/lib/settings";
import { SETTING_KEYS, SECRET_KEYS, MASK_VALUE } from "@/lib/settings/constants";
import { z } from "zod/v4";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function saveSettings(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  await requireAdmin();

  const entries = Object.values(SETTING_KEYS);
  for (const key of entries) {
    const value = formData.get(key) as string | null;
    if (value === null) continue;

    // Skip masked values -- admin didn't change this secret
    if (SECRET_KEYS.has(key) && value === MASK_VALUE) continue;

    await setSetting(key, value, SECRET_KEYS.has(key));
  }

  return { success: true };
}
```

### Cron Schedule Preview with cronstrue
```typescript
// Client component pattern for cron preview
"use client";
import { useState } from "react";
import cronstrue from "cronstrue";

function CronInput({ defaultValue }: { defaultValue: string }) {
  const [expression, setExpression] = useState(defaultValue);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  function handleChange(value: string) {
    setExpression(value);
    try {
      const desc = cronstrue.toString(value);
      setPreview(desc);
      setError("");
    } catch {
      setPreview("");
      setError("Invalid cron expression");
    }
  }

  return (
    <div>
      <Input value={expression} onChange={(e) => handleChange(e.target.value)} />
      {preview && <p className="text-sm text-green-600">{preview}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

### Incremental Sync: SHA Comparison
```typescript
// src/lib/github/sync.ts (core pattern)
import { eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { githubFiles } from "@/lib/db/schema";

interface ChangeSet {
  added: TreeFile[];    // New files (not in DB)
  modified: TreeFile[]; // SHA changed
  removed: string[];    // In DB but not in tree (file paths)
}

export async function detectChanges(remoteTree: TreeFile[]): Promise<ChangeSet> {
  const db = getDb();
  const storedFiles = await db.select().from(githubFiles);
  const storedMap = new Map(storedFiles.map(f => [f.filePath, f]));
  const remotePaths = new Set(remoteTree.map(f => f.path));

  const added: TreeFile[] = [];
  const modified: TreeFile[] = [];

  for (const remote of remoteTree) {
    const stored = storedMap.get(remote.path);
    if (!stored) {
      added.push(remote);
    } else if (stored.fileSha !== remote.sha) {
      modified.push(remote);
    }
  }

  const removed = storedFiles
    .filter(f => !remotePaths.has(f.filePath))
    .map(f => f.filePath);

  return { added, modified, removed };
}
```

### Test Connection Pattern
```typescript
// src/app/api/admin/settings/test-connection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, apiKey } = await req.json();

  if (type === "openrouter") {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json({ success: false, error: String(e) });
    }
  }

  // Similar for SendGrid, Slack, GitHub...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgboss for job queue | Cron-triggered API route | Project decision (pre-Phase 1) | No persistent job queue dependency; simpler Docker setup; cron expression stored in `site_settings` |
| `octokit` (monorepo package) | `@octokit/rest` (focused) | General ecosystem preference | Smaller bundle, only REST API (no GraphQL overhead) |
| Advisory locks for concurrency | Atomic status INSERT on sync_logs | Required by Neon HTTP driver | Works with stateless HTTP; no WebSocket dependency needed |
| Server-side encryption of secrets | `isSecret` flag with UI masking | Project decision (Phase 1 schema) | Simpler; secrets stored as plain text in DB but never sent to frontend; DB access is already server-only |

**Deprecated/outdated:**
- pgboss: Explicitly replaced per project decision. Do not use.
- `next-auth` v4 API: Project uses v5 beta (NextAuth v5). All auth code uses v5 patterns.

## Open Questions

1. **Cron scheduler deployment mechanism**
   - What we know: The API route (`/api/admin/sync/cron`) exists, protected by CRON_SECRET. The cron expression is stored in `site_settings`.
   - What's unclear: How the external cron gets configured with the admin's schedule. Options: (a) Docker host cron with fixed schedule, admin sets sync_schedule as metadata only; (b) the app writes to a crontab file; (c) use `node-cron` in a custom instrumentation file to read the schedule from DB on startup.
   - Recommendation: Use a fixed Docker cron (e.g., every 5 minutes) that calls the API route, and have the route itself check if the admin-configured schedule says a sync is due. This decouples the cron frequency from the sync schedule and avoids dynamic crontab management. The route reads the `sync_schedule` setting, computes next scheduled time with `cron-parser`, and only runs if it's time.

2. **Exponential backoff retry on sync failure**
   - What we know: GHUB-07 requires "automatic retries with exponential backoff."
   - What's unclear: How many retries, what delay, and what failures trigger retries (network errors vs. auth errors).
   - Recommendation: Implement 3 retries with delays of 1s, 4s, 16s for transient errors (network, rate limit). Non-retryable errors (401 auth, 404 repo not found) should fail immediately. Retry logic lives in the sync orchestrator function, not in Octokit (which has its own rate-limit retry).

3. **File content storage strategy**
   - What we know: `github_files` table stores path and SHA but not content. Phase 3 (AI Pipeline) will need file content for analysis.
   - What's unclear: Whether to fetch and store file content in Phase 2 or defer to Phase 3.
   - Recommendation: Phase 2 should only store file metadata (path, SHA, lastSyncedAt) in `github_files`. File content fetching happens in Phase 3 when the AI pipeline requests it. This keeps Phase 2 focused on change detection and tree management.

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Git Trees](https://docs.github.com/en/rest/git/trees) - Tree endpoint, recursive parameter, truncation limits (100k entries / 7MB)
- [GitHub REST API - Repository Contents](https://docs.github.com/en/rest/repos/contents) - File content retrieval, 1MB/100MB limits, 1000 file directory limit
- [Neon Serverless Driver docs](https://neon.com/docs/serverless/serverless-driver) - HTTP mode limitations: no sessions, no advisory locks, non-interactive transactions only
- [Neon Queue System Guide](https://neon.com/guides/queue-system) - SKIP LOCKED pattern for Neon Postgres
- [Drizzle ORM Batch API](https://orm.drizzle.team/docs/batch-api) - Batch operations run in implicit transaction on Neon HTTP
- Existing project codebase - schema.ts, db/index.ts, Phase 1 patterns (server actions, requireAdmin, Zod validation)

### Secondary (MEDIUM confidence)
- [@octokit/rest npm](https://www.npmjs.com/package/@octokit/rest) - v22.0.1, 3227 dependents
- [cronstrue npm](https://www.npmjs.com/package/cronstrue) - v3.9.0, zero dependencies, 5/6/7 part support
- [cron-parser GitHub](https://github.com/harrisiirak/cron-parser) - Validation, next occurrence, timezone
- [How to Secure Vercel Cron Job routes](https://codingcat.dev/post/how-to-secure-vercel-cron-job-routes-in-next-js-14-app-router) - CRON_SECRET + Bearer auth pattern
- [PostgreSQL Advisory Locks explained](https://flaviodelgrosso.com/blog/postgresql-advisory-locks) - Advisory lock patterns (used to determine they won't work with Neon HTTP)

### Tertiary (LOW confidence)
- [Next.js cron self-hosted patterns](https://yagyaraj234.medium.com/running-cron-jobs-in-nextjs-guide-for-serverful-and-stateless-server-542dd0db0c4c) - node-cron for persistent servers (not directly applicable due to standalone output mode)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Octokit is the de facto GitHub API client; cronstrue/cron-parser are standard for cron handling; all verified via npm and official docs
- Architecture: HIGH - Settings key-value store pattern is well-established; file tree SHA comparison is the standard GitHub sync approach; concurrency pattern verified against Neon HTTP limitations
- Pitfalls: HIGH - Secret masking, Neon HTTP stateless limitations, and TypeScript type-narrowing issues are well-documented and verified across multiple sources
- Cron deployment: MEDIUM - The "fixed-frequency cron + route checks schedule" pattern is a reasonable solution but not explicitly documented as a standard pattern

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days - stable domain, libraries are mature)
