# Phase 5: Article Editing & Version History - Research

**Researched:** 2026-02-13
**Domain:** WYSIWYG editing (BlockNote), image processing (sharp), version diffing, AI review annotations
**Confidence:** HIGH

## Summary

Phase 5 adds four major capabilities: (1) a BlockNote WYSIWYG editor storing native JSON, (2) image upload/paste with sharp compression, (3) version history with diff viewer and rollback, and (4) AI review annotations after merge. The project already has significant infrastructure in place: the database schema has `contentJson` (jsonb, nullable) on both `articles` and `articleVersions`, the `articleImages` table exists, the `diff` library (v8.0.3) is installed, `@blocknote/server-util` (v0.46.2) is installed for server-side conversion, and the merge/version/conflict pipeline is operational.

The critical architectural decision is already made: BlockNote JSON is the native editor storage format. The AI pipeline stores `contentMarkdown` only (with `contentJson = null`). When a user first opens the editor, markdown is converted to BlockNote JSON client-side via `editor.tryParseMarkdownToBlocks()`. On save, the editor stores `contentJson` (authoritative for editing) and regenerates `contentMarkdown` via `editor.blocksToMarkdownLossy()` for AI merge operations. When AI re-updates an article, it merges on markdown and resets `contentJson` to null.

**Primary recommendation:** Use `@blocknote/shadcn` (matching the project's existing shadcn/ui + Tailwind stack), load the editor via `next/dynamic` with `ssr: false`, build a custom diff viewer with the existing `diff` library + Tailwind (avoiding `react-diff-viewer-continued` which has React 19 + emotion compatibility issues), and design the `ai_review_annotations` table from scratch since it does not yet exist in the schema.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @blocknote/core | 0.46.2 | Editor core engine | Must match installed @blocknote/server-util version |
| @blocknote/react | 0.46.2 | React bindings (useCreateBlockNote, BlockNoteView) | Official React integration, supports React 19 |
| @blocknote/shadcn | 0.46.2 | shadcn-compatible UI layer for BlockNote | Project already uses shadcn/ui + Tailwind; avoids Mantine dependency |
| sharp | 0.34.x | Image compression, resize, EXIF stripping | Already specified in requirements; high-performance, widely adopted |
| diff | 8.0.3 | Compute line-level diffs for version comparison | Already installed; provides diffLines, structuredPatch |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @blocknote/server-util | 0.46.2 | Server-side BlockNote JSON <-> Markdown conversion | Already installed; used in src/lib/content/markdown.ts |
| next/dynamic | (built-in) | Dynamic import with ssr: false for editor | Required -- BlockNote is client-only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @blocknote/shadcn | @blocknote/mantine | Would add Mantine as dependency -- project uses shadcn/Tailwind |
| Custom diff viewer | react-diff-viewer-continued | Has emotion dependency with React 19 compatibility issues (open issue #63); emotion adds CSS-in-JS overhead to Tailwind project |
| Computing diffs on-the-fly | Storing diff_from_previous column | On-the-fly is simpler (no migration needed), articles are small enough that perf is not a concern |

**Installation:**
```bash
npm install @blocknote/core@0.46.2 @blocknote/react@0.46.2 @blocknote/shadcn@0.46.2 sharp
```

Note: `sharp` is listed as a requirement but is NOT currently in package.json. It must be added. The `diff` library (v8.0.3) is already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (wiki)/wiki/[articleSlug]/
      page.tsx                    # Existing -- add edit button, pass contentJson
      edit/
        page.tsx                  # Edit page (server component, loads article data)
    api/
      articles/[id]/
        images/
          route.ts                # POST: upload image, GET: not needed (separate serving route)
        save/
          route.ts                # POST: save article (creates version, updates article)
        versions/
          route.ts                # GET: list versions with filtering
        versions/[versionId]/
          route.ts                # GET: single version content
        restore/
          route.ts                # POST: restore to specific version
        dismiss-review/
          route.ts                # Already exists
      images/[articleId]/[filename]/
        route.ts                  # GET: serve images from /data/images/
  components/
    editor/
      article-editor.tsx          # Client component: BlockNote editor wrapper
      editor-toolbar.tsx          # Custom toolbar configuration (if needed)
      editor-save-dialog.tsx      # Save dialog with change summary prompt
    wiki/
      version-history.tsx         # Version list with filtering
      diff-viewer.tsx             # Custom side-by-side / inline diff viewer
      version-compare.tsx         # Version comparison selector
      annotation-banner.tsx       # AI review annotations banner
      annotation-card.tsx         # Individual annotation card
  lib/
    content/
      markdown.ts                 # Already exists -- server-side BlockNote conversion
      version.ts                  # Already exists -- createArticleVersion, getLastAIVersion
    images/
      compress.ts                 # sharp image processing pipeline
      storage.ts                  # File system read/write for /data/images/
    ai/
      review.ts                   # LLM review pass for annotations after merge
```

### Pattern 1: BlockNote Editor as Dynamic Client Component
**What:** The editor MUST be loaded client-side only. Next.js App Router requires a specific pattern.
**When to use:** Always for BlockNote.
**Example:**
```typescript
// src/components/editor/article-editor.tsx
"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

interface ArticleEditorProps {
  initialContent?: any; // BlockNote Block[]
  articleId: string;
  onSave: (blocks: any[], markdown: string) => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
}

export function ArticleEditor({ initialContent, articleId, uploadFile }: ArticleEditorProps) {
  const editor = useCreateBlockNote({
    initialContent,
    uploadFile,
  });

  return <BlockNoteView editor={editor} />;
}

// src/components/editor/dynamic-editor.tsx
"use client";
import dynamic from "next/dynamic";
export const DynamicEditor = dynamic(
  () => import("./article-editor").then(mod => ({ default: mod.ArticleEditor })),
  { ssr: false }
);
```

### Pattern 2: Content Storage Lifecycle (Dual-Format)
**What:** AI stores markdown only. Editor stores BlockNote JSON + regenerates markdown on save.
**When to use:** Every save and every AI update follows this cycle.
**Example:**
```
LOAD for editing:
  1. If contentJson exists -> use it directly as editor initialContent
  2. If contentJson is null -> convert contentMarkdown via editor.tryParseMarkdownToBlocks()
     (client-side, inside the editor component)

SAVE from editor:
  1. Get blocks: JSON.stringify(editor.document) -> contentJson
  2. Convert to markdown: editor.blocksToMarkdownLossy() -> contentMarkdown
  3. POST to save API: { contentJson, contentMarkdown, changeSummary }
  4. Server creates articleVersions record (change_source: 'human_edited')
  5. Server updates articles table (contentJson, contentMarkdown, hasHumanEdits=true, timestamps)

AI UPDATE (already implemented):
  1. Merges on contentMarkdown (three-way merge)
  2. Sets contentJson = null (forces re-conversion on next editor open)
```

### Pattern 3: Image Upload Flow
**What:** Images uploaded via the editor's uploadFile handler, compressed server-side, stored on filesystem.
**When to use:** When user pastes or uploads an image in the editor.
**Example:**
```typescript
// Upload handler passed to useCreateBlockNote
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/articles/${articleId}/images`, {
    method: "POST",
    body: formData,
  });

  const { url } = await response.json();
  return url; // e.g., "/api/images/{articleId}/{filename}"
}

// Server-side compression (src/lib/images/compress.ts)
import sharp from "sharp";

export async function compressImage(buffer: Buffer): Promise<{
  data: Buffer;
  info: { width: number; height: number; size: number };
}> {
  const result = await sharp(buffer)
    .resize(1200, 1200, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    info: {
      width: result.info.width,
      height: result.info.height,
      size: result.info.size,
    },
  };
}
```

### Pattern 4: Custom Diff Viewer with Tailwind
**What:** Build diff viewer using the existing `diff` library + Tailwind classes instead of a third-party React diff component.
**When to use:** For version comparison (side-by-side and inline modes).
**Example:**
```typescript
import { diffLines, type Change } from "diff";

// Compute diff on the server or client
const changes: Change[] = diffLines(oldContent, newContent);

// Render with Tailwind classes
{changes.map((change, i) => (
  <div
    key={i}
    className={cn(
      "font-mono text-sm whitespace-pre-wrap px-4 py-0.5",
      change.added && "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200",
      change.removed && "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200",
      !change.added && !change.removed && "text-muted-foreground"
    )}
  >
    <span className="select-none mr-2 text-muted-foreground">
      {change.added ? "+" : change.removed ? "-" : " "}
    </span>
    {change.value}
  </div>
))}
```

### Pattern 5: AI Review Annotations After Merge
**What:** After a clean merge of human-edited article with AI update, run an LLM pass to check for semantic issues. Store annotations separately.
**When to use:** In the merge pipeline (conflict.ts or pipeline.ts), after a successful `ai_merged` operation on a `hasHumanEdits` article.
**Example:**
```typescript
// After merge completes in pipeline, call review:
if (existing.hasHumanEdits && !mergeResult.hasConflicts) {
  await generateReviewAnnotations({
    articleId,
    mergedMarkdown: resolution.finalMarkdown,
    aiProposedMarkdown: contentMarkdown,
    humanMarkdown: currentMarkdown,
    changeSummary: articlePlan.change_summary,
  });
}
```

### Anti-Patterns to Avoid
- **Server-side BlockNote rendering:** `@blocknote/server-util` crashes in RSC/Turbopack due to createContext. Only use for conversion (blocksToMarkdownLossy, tryParseMarkdownToBlocks), never for rendering. Dynamic import if called from server code.
- **Storing conflict markers in content:** Already decided -- human version kept on conflict, AI proposal in version history.
- **Markdown round-trip in editor:** Do NOT convert JSON -> Markdown -> JSON. Store JSON natively, only generate markdown on save for AI consumption.
- **Using react-diff-viewer-continued:** Adds emotion CSS-in-JS (conflicts with Tailwind approach), has open React 19 peer dependency issue.
- **Synchronous large image processing:** Always process images asynchronously; sharp operations should be awaited, not blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WYSIWYG editing | Custom ProseMirror/TipTap setup | BlockNote (@blocknote/react + @blocknote/shadcn) | Toolbar, drag-drop, block types, image blocks all built-in |
| Image compression | Custom canvas/jimp pipeline | sharp | Hardware-accelerated via libvips, handles EXIF, resize, format conversion in one pipeline |
| Text diffing algorithm | Custom diff algorithm | diff (npm) diffLines/structuredPatch | Battle-tested, handles edge cases, already installed |
| Three-way merge | Custom merge logic | node-diff3 (already installed and used) | Already working in src/lib/merge/three-way.ts |
| Markdown <-> BlockNote conversion | Custom parser | @blocknote/server-util (already installed) | Already working in src/lib/content/markdown.ts |

**Key insight:** The editor and image compression have existing, well-tested library solutions. The diff VIEWER is the one area where a custom build (with Tailwind) is preferable to a library, because the available libraries have compatibility issues with React 19 + Tailwind.

## Common Pitfalls

### Pitfall 1: BlockNote SSR Crash
**What goes wrong:** BlockNote imports fail in server components, causing build errors or runtime crashes.
**Why it happens:** BlockNote depends on browser APIs (DOM, window). The `@blocknote/server-util` specifically uses `createContext` which crashes in RSC/Turbopack.
**How to avoid:** Always use `next/dynamic` with `ssr: false` for the editor component. The dynamic import MUST be in a `"use client"` file. For server-side conversion (markdown.ts), use dynamic `import()` from calling code (already established pattern in pipeline.ts).
**Warning signs:** "createContext is not a function" or "window is not defined" errors at build time.

### Pitfall 2: BlockNote + React StrictMode
**What goes wrong:** BlockNote throws errors in development mode with React StrictMode enabled.
**Why it happens:** BlockNote is not yet compatible with React 19 StrictMode (as of v0.46.2). The double-render in StrictMode causes issues.
**How to avoid:** Check if `reactStrictMode` is in next.config.ts. The current project config does NOT set it (defaults to undefined, which means disabled in Next.js). If it gets enabled later, BlockNote will break in dev. Keep it disabled or set `reactStrictMode: false` explicitly.
**Warning signs:** Editor crashes only in development, works fine in production build.

### Pitfall 3: shadcn Components with Portals
**What goes wrong:** BlockNote dropdowns/popovers don't position correctly or disappear.
**Why it happens:** `@blocknote/shadcn` requires that passed shadcn components do NOT use Portals. The project's `DropdownMenu`, `Tooltip`, etc. use Portals by default.
**How to avoid:** Do NOT pass the project's existing shadcn components via `shadCNComponents` prop unless you remove Portal usage from those specific copies. The simplest approach: use `@blocknote/shadcn`'s built-in components (don't pass `shadCNComponents` at all) and just configure the Tailwind `@source` directive.
**Warning signs:** Menus render in wrong position, or floating elements appear behind other content.

### Pitfall 4: Lossy Markdown Conversion
**What goes wrong:** Content fidelity loss when converting between BlockNote JSON and Markdown.
**Why it happens:** `blocksToMarkdownLossy()` drops certain styles and un-nests children of non-list blocks. `tryParseMarkdownToBlocks()` may not recognize all markdown constructs.
**How to avoid:** Store BlockNote JSON as the authoritative editor format. Only generate markdown for AI consumption (where lossiness is acceptable). Never round-trip: JSON -> Markdown -> JSON.
**Warning signs:** Formatting disappears after save, nested content flattens.

### Pitfall 5: Image Path Consistency Between Dev and Docker
**What goes wrong:** Images uploaded in dev can't be found, or Docker container can't access the image directory.
**Why it happens:** Dev uses a local path (e.g., `./data/images/`), Docker uses `/data/images/` with a volume mount.
**How to avoid:** Use an environment variable or constant for the image root path. Default to `/data/images` in production, `./data/images` in development. Ensure the directory exists at startup.
**Warning signs:** 404s on image URLs, "ENOENT: no such file or directory" errors.

### Pitfall 6: Race Condition on Save
**What goes wrong:** User saves while an AI pipeline is updating the same article, leading to lost edits.
**Why it happens:** No optimistic locking or version checking on save.
**How to avoid:** On save, check that the article's `updatedAt` matches what the editor loaded. If it changed, warn the user that the article was modified externally. Consider storing the `updatedAt` the editor loaded with and comparing on save.
**Warning signs:** User's edits silently disappear after an AI sync runs.

### Pitfall 7: localStorage Draft Conflicts
**What goes wrong:** User opens editor in two tabs, auto-save overwrites one draft with the other.
**Why it happens:** localStorage is shared across tabs for the same origin.
**How to avoid:** Key localStorage drafts by articleId + a session/tab identifier, or use a simple timestamp check. Alternatively, only save to localStorage on blur/beforeunload, not on every keystroke.
**Warning signs:** Draft content appears from a different editing session.

## Code Examples

### BlockNote Editor Setup with shadcn (Verified Pattern)
```typescript
// Source: https://www.blocknotejs.org/docs/getting-started/shadcn
// src/components/editor/article-editor.tsx
"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useState, useCallback } from "react";

interface ArticleEditorProps {
  articleId: string;
  initialContentJson: unknown | null;
  initialContentMarkdown: string;
  articleUpdatedAt: string; // For optimistic locking
}

export function ArticleEditor({
  articleId,
  initialContentJson,
  initialContentMarkdown,
  articleUpdatedAt,
}: ArticleEditorProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Upload handler for images
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/articles/${articleId}/images`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url;
  }, [articleId]);

  const editor = useCreateBlockNote({
    uploadFile,
    // initialContent set after markdown conversion (see below)
  });

  // NOTE: initialContent must be set via useCreateBlockNote's initialContent option.
  // If contentJson exists, pass it directly.
  // If contentJson is null, convert markdown client-side:
  //   const blocks = await editor.tryParseMarkdownToBlocks(initialContentMarkdown);
  //   editor.replaceBlocks(editor.document, blocks);
  // This must happen in a useEffect after editor creation.

  return (
    <BlockNoteView
      editor={editor}
      onChange={() => {
        // Auto-save draft to localStorage
        const content = JSON.stringify(editor.document);
        localStorage.setItem(`draft-${articleId}`, content);
      }}
    />
  );
}
```

### Sharp Image Compression Pipeline
```typescript
// Source: https://sharp.pixelplumbing.com/api-resize + https://sharp.pixelplumbing.com/api-output
// src/lib/images/compress.ts
import sharp from "sharp";

export async function compressImage(inputBuffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}> {
  const result = await sharp(inputBuffer)
    .resize(1200, 1200, {
      fit: "inside",           // Maintain aspect ratio, fit within bounds
      withoutEnlargement: true, // Never upscale
    })
    .jpeg({
      quality: 80,              // JPEG quality 80
      mozjpeg: true,            // Better compression
    })
    // sharp strips metadata by default (EXIF removed)
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
    sizeBytes: result.info.size,
  };
}
```

### Diff Computation for Version Comparison
```typescript
// Source: https://www.npmjs.com/package/diff (already installed v8.0.3)
// src/lib/content/diff-utils.ts
import { diffLines, type Change } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
  const changes: Change[] = diffLines(oldContent, newContent);
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lineTexts = change.value.split("\n");
    // Remove trailing empty string from split
    if (lineTexts[lineTexts.length - 1] === "") lineTexts.pop();

    for (const text of lineTexts) {
      if (change.added) {
        lines.push({ type: "added", content: text, newLineNumber: newLine++ });
      } else if (change.removed) {
        lines.push({ type: "removed", content: text, oldLineNumber: oldLine++ });
      } else {
        lines.push({ type: "unchanged", content: text, oldLineNumber: oldLine++, newLineNumber: newLine++ });
      }
    }
  }

  return lines;
}
```

### Article Save Server Action
```typescript
// Conceptual pattern for the save endpoint
// POST /api/articles/[id]/save
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { contentJson, contentMarkdown, changeSummary, loadedUpdatedAt } = await request.json();

  const db = getDb();

  // Optimistic locking: check article hasn't been modified since editor loaded
  const [article] = await db.select({ updatedAt: articles.updatedAt }).from(articles).where(eq(articles.id, id)).limit(1);
  if (article && article.updatedAt.toISOString() !== loadedUpdatedAt) {
    return NextResponse.json({ error: "Article was modified. Please reload." }, { status: 409 });
  }

  // Update article
  await db.update(articles).set({
    contentMarkdown,
    contentJson,
    hasHumanEdits: true,
    lastHumanEditedAt: new Date(),
    lastHumanEditorId: session.user.id,
    updatedAt: new Date(),
  }).where(eq(articles.id, id));

  // Create version record
  await createArticleVersion({
    articleId: id,
    contentMarkdown,
    contentJson,
    changeSource: "human_edited",
    changeSummary: changeSummary || null,
    createdBy: session.user.id,
  });

  return NextResponse.json({ success: true });
}
```

## Database Changes Required

### New Table: ai_review_annotations
The `ai_review_annotations` table does NOT exist in the current schema (schema.ts). It must be added.

```typescript
// Recommended schema addition
export const annotationSeverityEnum = pgEnum("annotation_severity", [
  "info",
  "warning",
  "error",
]);

export const aiReviewAnnotations = pgTable(
  "ai_review_annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .references(() => articleVersions.id, { onDelete: "set null" }),
    sectionHeading: text("section_heading").notNull(),
    concern: text("concern").notNull(),
    severity: annotationSeverityEnum("severity").notNull(),
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    dismissedBy: uuid("dismissed_by").references(() => users.id),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_ai_review_annotations_article").on(t.articleId)]
);
```

### No Changes Needed for Existing Tables
- `articles`: Already has `contentJson`, `hasHumanEdits`, `lastHumanEditedAt`, `lastHumanEditorId`, `needsReview`
- `articleVersions`: Already has `contentJson`, `changeSource`, `changeSummary`, `createdBy`
- `articleImages`: Already has `articleId`, `fileName`, `filePath`, `mimeType`, `sizeBytes`, `uploadedBy`

### Note on VERS-05 (diff_from_previous)
The requirement says "Each version stores full content markdown and unified diff from previous." The `articleVersions` table does NOT have a `diff_from_previous` column, and the spec's schema doesn't include it either. **Recommendation:** Compute diffs on-the-fly using the `diff` library. Articles are small enough (tens of KB) that this adds negligible latency. Avoids a schema migration and keeps version records simpler. The `generateUnifiedDiff` function already exists in `src/lib/merge/diff.ts`.

## Tailwind Configuration for BlockNote

The `@blocknote/shadcn` package requires a Tailwind `@source` directive to generate its utility classes:

```css
/* Add to globals.css */
@source "../node_modules/@blocknote/shadcn";
```

This tells Tailwind v4 to scan the BlockNote shadcn package for class names when generating CSS.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BlockNote Mantine UI | BlockNote shadcn UI | v0.40+ (2025) | Native Tailwind integration, no Mantine dependency |
| Separate Markdown editor (Milkdown) | BlockNote with native JSON storage | Project decision | Simpler architecture, no lossy round-trip |
| react-diff-viewer (emotion) | Custom diff viewer (diff lib + Tailwind) | React 19 (2025) | Avoids emotion peer dep issue, stays in Tailwind ecosystem |
| @blocknote/server-util in RSC | Client-side conversion only | Phase 3 UAT finding | Avoids createContext crash in RSC/Turbopack |

**Deprecated/outdated:**
- `@blocknote/mantine`: Still works but unnecessary if using shadcn/Tailwind
- `react-diff-viewer` (original): Unmaintained, superseded by `react-diff-viewer-continued`
- `react-diff-viewer-continued`: Technically current but has React 19 peer dep issues via emotion

## Key Integration Points with Existing Code

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| `src/lib/db/schema.ts` | Add `aiReviewAnnotations` table + `annotationSeverityEnum` | New table for plan 05-04 |
| `src/components/wiki/article-tabs.tsx` | Enable History tab, add Edit button routing | Currently disabled placeholder |
| `src/app/(wiki)/wiki/[articleSlug]/page.tsx` | Pass contentJson + updatedAt to editor route, fetch annotations | Editor needs initial data |
| `src/lib/merge/conflict.ts` | Add AI review annotation generation after clean merge | Post-merge LLM review (plan 05-04) |
| `src/lib/ai/pipeline.ts` | Trigger annotation generation after merge | Pipeline integration (plan 05-04) |
| `src/app/globals.css` | Add `@source` directive for BlockNote shadcn | Tailwind class generation |
| `next.config.ts` | Potentially add `reactStrictMode: false` explicitly | Prevent future StrictMode issues |
| `Dockerfile` | Likely no changes needed -- /data/images already provisioned | Volume mount exists |

### Existing Utilities to Reuse
| Utility | Location | Purpose in Phase 5 |
|---------|----------|---------------------|
| `createArticleVersion` | `src/lib/content/version.ts` | Creating version records on save |
| `getLastAIVersion` | `src/lib/content/version.ts` | Finding merge base |
| `blocksToMarkdown` | `src/lib/content/markdown.ts` | Converting BlockNote JSON to markdown on save (server-side) |
| `markdownToBlocks` | `src/lib/content/markdown.ts` | Available but NOTE: should use client-side conversion instead |
| `generateUnifiedDiff` | `src/lib/merge/diff.ts` | Computing diffs for version comparison |
| `getAIModel` | `src/lib/ai/client.ts` | For the LLM review pass (annotations) |
| `auth` | `src/lib/auth` | Authentication checks in API routes |
| `getDb` | `src/lib/db` | Database access |

## Open Questions

1. **BlockNote initialContent from markdown conversion timing**
   - What we know: If `contentJson` is null, we must convert markdown to blocks client-side via `editor.tryParseMarkdownToBlocks()`
   - What's unclear: The exact sequencing -- `useCreateBlockNote` takes `initialContent` at creation time, but the async conversion can't happen before creation. Need to either: (a) convert before creating editor (two-step mount), or (b) create editor empty then replace blocks in useEffect.
   - Recommendation: Use approach (b) -- create editor, then `useEffect` to parse markdown and `editor.replaceBlocks()`. Show a loading skeleton while converting.

2. **Image serving route vs. Next.js static file serving**
   - What we know: Images at `/data/images/{articleId}/{filename}` need to be served via API route per spec
   - What's unclear: Whether Next.js `public` folder or a `next.config.ts` rewrite could simplify this
   - Recommendation: Use API route (`GET /api/images/[articleId]/[filename]`) as specified. It gives control over cache headers and access patterns. `public` folder isn't suitable for dynamic uploads.

3. **AI review annotation trigger point**
   - What we know: Should happen "after AI merges a human-edited article" per requirements
   - What's unclear: Whether it should run in the sync pipeline (blocking) or asynchronously after sync completes
   - Recommendation: Run inline in the pipeline after merge (before moving to next article). The LLM call is fast (small input) and annotations need to be available immediately. Can be made async later if needed.

## Sources

### Primary (HIGH confidence)
- BlockNote official docs: https://www.blocknotejs.org/docs/getting-started/shadcn -- shadcn setup
- BlockNote official docs: https://www.blocknotejs.org/docs/editor-basics/setup -- editor configuration
- BlockNote official docs: https://www.blocknotejs.org/docs/features/import/markdown -- markdown conversion API
- BlockNote official docs: https://www.blocknotejs.org/docs/features/export/markdown -- blocksToMarkdownLossy
- BlockNote official docs: https://www.blocknotejs.org/examples/backend/file-uploading -- uploadFile handler
- BlockNote releases: https://github.com/TypeCellOS/BlockNote/releases -- v0.46.2 (Jan 2026)
- sharp official docs: https://sharp.pixelplumbing.com/api-resize -- resize with fit:inside
- sharp official docs: https://sharp.pixelplumbing.com/api-output -- JPEG quality, metadata stripping
- diff npm: https://www.npmjs.com/package/diff -- diffLines API (v8.0.3)
- Existing codebase: src/lib/content/markdown.ts, src/lib/merge/*, src/lib/content/version.ts

### Secondary (MEDIUM confidence)
- BlockNote Next.js guide: https://www.blocknotejs.org/docs/getting-started/nextjs -- dynamic import pattern
- react-diff-viewer-continued React 19 issue: https://github.com/Aeolun/react-diff-viewer-continued/issues/63
- @blocknote/react peer deps: npm view shows React 18/19 support

### Tertiary (LOW confidence)
- BlockNote StrictMode compatibility: documented as dev-only issue, may be fixed in future releases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, official docs, and existing codebase usage
- Architecture: HIGH - Follows established patterns from phases 1-4, dual-format storage lifecycle well-documented in project decisions
- Pitfalls: HIGH - Pitfalls 1-4 verified from official BlockNote docs and project history; Pitfalls 5-7 from common patterns
- AI annotations: MEDIUM - Table schema designed from requirements (no existing implementation to reference); LLM review prompt needs iteration

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (BlockNote releases monthly; sharp is stable)
