---
status: resolved
trigger: "No-op edit shows massive diffs in History tab diff viewer"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- see Resolution below
test: N/A (code analysis complete)
expecting: N/A
next_action: N/A -- root cause fully identified

## Symptoms

expected: A no-op edit (open editor, save without changes) should produce zero diff or no version entry
actual: Even a no-op save shows massive diffs across the entire article when comparing versions in the History tab
errors: None (functional, not crash)
reproduction: Open "Resource-Library" article -> Edit -> Save immediately without changing anything -> Go to History tab -> Compare the "human_edited" version with the previous "ai_generated" version -> Massive diff
started: Since editor + version history were both implemented

## Eliminated

(none -- hypothesis confirmed on first investigation)

## Evidence

- timestamp: 2026-02-13T00:01:00Z
  checked: AI pipeline content storage (src/lib/ai/pipeline.ts, src/lib/ai/generate.ts)
  found: AI pipeline stores contentMarkdown directly from LLM output. contentJson is explicitly set to NULL with a comment explaining why: "contentJson left null -- BlockNote conversion deferred to viewer/editor to avoid @blocknote/server-util createContext crash in RSC/Turbopack."
  implication: The first version of any AI-generated article has raw LLM markdown, and contentJson=null.

- timestamp: 2026-02-13T00:02:00Z
  checked: Editor content loading (src/components/editor/article-editor.tsx lines 84-111)
  found: |
    The editor loads content via this logic:
    1. If contentJson exists (non-empty array), load directly into BlockNote
    2. Otherwise, parse contentMarkdown via `editor.tryParseMarkdownToBlocks(initialContentMarkdown)`

    For AI-generated articles, contentJson is null, so it ALWAYS falls into path 2: parse markdown into BlockNote blocks. This is a LOSSY round-trip -- markdown -> BlockNote JSON -> (implicit internal representation).
  implication: The very act of opening the editor transforms the markdown representation through BlockNote's parser.

- timestamp: 2026-02-13T00:03:00Z
  checked: Editor save handler (src/components/editor/article-editor.tsx lines 145-182)
  found: |
    On save, the editor calls:
    ```
    contentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    ```
    The method name literally says "Lossy". This serializes BlockNote's internal JSON representation BACK to markdown.
    The result is sent to `/api/articles/[id]/save` along with contentJson.
  implication: The save path is: AI markdown -> BlockNote parse -> BlockNote internal blocks -> blocksToMarkdownLossy -> NEW markdown. This is a lossy round-trip that changes formatting even when no human edits are made.

- timestamp: 2026-02-13T00:04:00Z
  checked: Save API route (src/app/api/articles/[id]/save/route.ts)
  found: |
    The save route directly stores `body.contentMarkdown` (the BlockNote-serialized version) as the new contentMarkdown and creates a version record with it. There is NO comparison between old and new contentMarkdown to detect no-op saves. There is also NO normalization of the markdown before storage.
  implication: Every save creates a new version with BlockNote's markdown output, regardless of whether content actually changed semantically.

- timestamp: 2026-02-13T00:05:00Z
  checked: Diff viewer (src/components/wiki/diff-viewer.tsx)
  found: |
    The diff viewer uses `diffLines(oldContent, newContent)` from the `diff` library. This does a raw string comparison of contentMarkdown between versions. There is an early-exit `if (oldContent === newContent)` but this will never trigger when comparing AI markdown vs BlockNote markdown.
  implication: The diff viewer correctly computes diffs, but it's comparing two different markdown serializations of the same content.

- timestamp: 2026-02-13T00:06:00Z
  checked: Version storage (src/lib/content/version.ts, src/lib/wiki/queries.ts)
  found: |
    Version history stores raw contentMarkdown from whatever source created it. The versions API returns this verbatim. When comparing an "ai_generated" version (LLM markdown) with a "human_edited" version (BlockNote markdown), the diff viewer shows formatting differences, not content differences.
  implication: The version history is faithfully storing the divergent markdown from two different serializers.

- timestamp: 2026-02-13T00:07:00Z
  checked: BlockNote version and lossy conversion utility (package.json, src/lib/content/markdown.ts)
  found: |
    Using @blocknote v0.46.2. The server-side utility (`src/lib/content/markdown.ts`) exists but is NOT used in the pipeline due to the RSC/Turbopack crash noted in pipeline.ts. The client-side editor uses the browser BlockNote instance for conversion. Known BlockNote markdown differences include:
    - Different blank line handling (extra/fewer blank lines between blocks)
    - Different heading whitespace (e.g., `# Title` vs `# Title\n`)
    - List formatting differences (indentation, continuation lines)
    - Inline formatting differences (bold/italic marker style)
    - Trailing newlines / whitespace normalization
    - Paragraph wrapping differences
  implication: Two completely different markdown serializers (LLM vs BlockNote) produce structurally different but semantically equivalent markdown.

## Resolution

root_cause: |
  **Two incompatible markdown serializers produce different text for the same content.**

  The data flow is:

  1. AI pipeline generates article -> stores `contentMarkdown` (raw LLM output) with `contentJson: null`
  2. User opens editor -> `contentJson` is null so editor calls `tryParseMarkdownToBlocks(contentMarkdown)` to parse LLM markdown into BlockNote blocks
  3. User saves (even without changes) -> editor calls `blocksToMarkdownLossy(document)` to serialize BlockNote blocks back to markdown
  4. Save API stores this NEW markdown as `contentMarkdown` in a new version record
  5. Diff viewer compares version N (LLM markdown) with version N+1 (BlockNote markdown) -> massive formatting diffs

  The round-trip `LLM markdown -> BlockNote parse -> BlockNote serialize` is inherently lossy and changes formatting, even when no human edits occur. This is equivalent to the classic "normalize on write" problem.

  **Contributing factors:**
  - The pipeline stores `contentJson: null` (cannot use server-util due to RSC crash)
  - The editor falls back to markdown parsing when contentJson is null
  - No markdown normalization step exists
  - No no-op detection (save always creates a version, even if content is identical)

fix: |
  **Two complementary fixes (both should be implemented):**

  **Fix 1 (Essential): No-op save detection in the save API route**
  In `src/app/api/articles/[id]/save/route.ts`, before creating a version, compare the incoming `contentMarkdown` with the article's current `contentMarkdown`. If identical, skip version creation (or return early with success but no new version). This prevents no-op edits from polluting version history.

  **Fix 2 (Root cause): Normalize markdown on first AI storage OR populate contentJson on first editor load**

  Option A: When the AI pipeline creates an article, also run the markdown through BlockNote's round-trip (`markdown -> blocks -> markdown`) so that the stored markdown is already in BlockNote's canonical format. This means the first human save will produce identical markdown. However, this requires solving the server-util RSC crash.

  Option B: Add a one-time "migration" step: when the editor first opens an article with `contentJson: null`, after parsing markdown to blocks and saving, ALSO save the contentJson back to the article. On the NEXT edit, the editor loads from contentJson directly (no re-parsing), so blocksToMarkdownLossy produces the same output as the previous save.

  Option C: When the save endpoint detects the article currently has `contentJson: null` (first human edit of AI content), normalize the PREVIOUS version's markdown to match BlockNote's format. This retroactively prevents the diff.

  **Recommended approach: Fix 1 + Option B**
  - Fix 1 is trivial and immediately prevents no-op version pollution
  - Option B ensures that after the first save, all subsequent no-op saves produce identical markdown (because contentJson is loaded directly, bypassing the markdown parse step)
  - The first save will still show formatting diffs (unavoidable without Option A), but this is acceptable since the user actually made the first human edit

verification: |
  Not yet verified -- this is a diagnosis-only investigation.

  To verify the root cause:
  1. Open a fresh AI-generated article in the editor (one with contentJson: null)
  2. Save immediately without changes
  3. Check the database: the new version's contentMarkdown will differ from the AI version's contentMarkdown
  4. Compare in diff viewer: massive formatting diffs confirm the issue

  To verify Fix 1:
  1. Implement no-op detection in save route
  2. Repeat the save-without-changes flow
  3. No new version should be created

  To verify Fix 1 + Option B:
  1. After first save, contentJson should be stored
  2. Open editor again and save again without changes
  3. The markdown should be identical to the first save (loaded from JSON, not re-parsed from markdown)
  4. No new version created (no-op detection)

files_changed: []

## Detailed Code Flow Analysis

### Path 1: AI Content Creation
```
LLM output -> contentMarkdown (stored as-is)
           -> contentJson = null (deferred, can't use server-util in RSC)
           -> version record created with LLM markdown
```

### Path 2: Editor Open (AI article, first time)
```
contentJson is null -> falls into markdown parse path
editor.tryParseMarkdownToBlocks(contentMarkdown) -> BlockNote JSON blocks
(This parse is lossy: LLM markdown != BlockNote's internal representation)
```

### Path 3: Editor Save
```
editor.blocksToMarkdownLossy(editor.document) -> NEW markdown (BlockNote format)
POST /api/articles/[id]/save with { contentMarkdown: NEW, contentJson: blocks }
-> version record created with BlockNote markdown
```

### The Divergence
```
Version 1 (ai_generated):  "## Overview\n\nThis section covers...\n\n- Item one\n- Item two\n"
Version 2 (human_edited):  "## Overview\n\nThis section covers...\n\n*   Item one\n*   Item two\n"
                                                                        ^^^^^         ^^^^^
                                                  (BlockNote uses different list markers, spacing, etc.)
```

### Key Files Involved

| File | Role in Bug |
|------|-------------|
| `src/lib/ai/pipeline.ts` | Stores contentJson=null, stores raw LLM markdown |
| `src/lib/ai/generate.ts` | Returns raw LLM markdown (contentMarkdown) |
| `src/components/editor/article-editor.tsx` | Parses markdown to blocks on load, serializes blocks to markdown on save |
| `src/app/api/articles/[id]/save/route.ts` | Stores BlockNote markdown without comparing to existing content |
| `src/lib/content/version.ts` | Creates version records with whatever markdown is passed |
| `src/components/wiki/diff-viewer.tsx` | Diffs raw contentMarkdown strings (correct behavior, wrong inputs) |
| `src/lib/content/markdown.ts` | Server-side BlockNote util exists but unused in pipeline due to RSC crash |
