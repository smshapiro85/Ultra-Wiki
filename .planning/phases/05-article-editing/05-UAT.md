---
status: complete
phase: 05-article-editing
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md
started: 2026-02-14T03:10:00Z
updated: 2026-02-14T04:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Edit Button on Article Page
expected: Navigate to any article page while logged in. A pencil/Edit button is visible on the page. Clicking it navigates to /wiki/[articleSlug]/edit.
result: pass

### 2. WYSIWYG Editor Loads
expected: On the edit page (/wiki/[articleSlug]/edit), a BlockNote rich-text editor renders with a toolbar showing headings, bold, italic, code, links, tables, and lists. The article's existing content is loaded into the editor.
result: pass

### 3. Draft Auto-Save & Recovery
expected: Make some edits in the editor without saving. Navigate away or close the tab, then return to the same edit page. A restore/discard banner appears offering to recover the unsaved draft. Clicking Restore loads the draft; clicking Discard removes it.
result: pass

### 4. Save with Change Summary
expected: Click Save in the editor. A dialog appears prompting for an optional change summary. Submitting saves the article and shows a success indication. The article page reflects the edits.
result: issue (fixed)
reported: "pass but after save the user should be navigated back to the page 'back to article' instead of staying there"
severity: minor
fix: Added router.push(/wiki/articleSlug) after successful save in article-editor.tsx

### 5. Image Paste/Upload in Editor
expected: In the editor, paste an image from clipboard or drag-drop an image file into the editor area. The image is uploaded, compressed, and appears inline in the editor content.
result: pass

### 6. History Tab Shows Versions
expected: On an article page, click the History tab. A list of version records appears showing date, source badge (AI Generated / Human Edited / etc.), creator name, and change summary for each version.
result: issue (fixed)
reported: "the DIFF is not working because when the user edits the article, even if they don't make any changes to the content or if they just change the title, the DIFF shows a bunch of variations of all the text below. I think it's because of the formatting or the way we're saving the data from when the AI creates the article to when the user edits it."
severity: major
fix: Created normalizeMarkdown() using remark AST with tight-list plugin. Applied in AI pipeline, save route, and versions API. Also fixed editor styling (heading sizes, block spacing, side menu heights) to match prose article view.

### 7. Version Source Filtering
expected: In the History tab, filter buttons (All, AI Generated, Human Edited, AI Merged, AI Updated) are visible. Clicking a filter shows only versions matching that source type.
result: pass

### 8. Version Comparison (Diff Viewer)
expected: In the History tab, click two version cards to select them. A Compare button appears. Clicking it shows a diff view with colored additions (green) and removals (red). Toggle between inline and side-by-side modes. The diff should only show actual content changes.
result: pass

### 9. Version Rollback (Restore)
expected: In the History tab, select one version. A Restore button appears. Clicking it shows a confirmation dialog. Confirming restores the article to that version's content. The history now shows a new "rollback" version entry (non-destructive).
result: pass

### 10. AI Review Annotation Banner
expected: After an AI merge updates a human-edited article (requires a sync that triggers the AI pipeline on an article you previously edited), the article page shows a collapsible "AI Review: N items need attention" banner below the article header. Expanding it shows annotation cards with concern description, referenced section, timestamp, and a Dismiss button.
result: skipped
reason: Requires AI sync on human-edited article (not set up in test environment)

### 11. Annotation Section Highlighting
expected: When the AI Review banner is expanded, referenced section headings in the article content have a yellow left-border highlight. Clicking an annotation card scrolls the page to that section.
result: skipped
reason: Requires AI annotations to exist (same prerequisite as test 10)

## Summary

total: 11
passed: 7
issues: 2 (both fixed during session)
pending: 0
skipped: 2

## Gaps

- truth: "Save navigates back to article page after successful save"
  status: fixed
  reason: "User reported: pass but after save the user should be navigated back to the page 'back to article' instead of staying there"
  severity: minor
  test: 4
  root_cause: "handleSave in article-editor.tsx did not redirect after successful save"
  artifacts:
    - path: "src/components/editor/article-editor.tsx"
      issue: "Missing router.push after save"
  missing:
    - "Added useRouter import and router.push(/wiki/articleSlug) after save success"
  debug_session: ""

- truth: "Diff between AI-generated and human-edited versions shows only actual content changes"
  status: fixed
  reason: "User reported: diff shows formatting differences (blank lines between list items, trailing whitespace) not real content changes"
  severity: major
  test: 6
  root_cause: "BlockNote blocksToMarkdownLossy produces loose lists (blank line between items) and trailing newlines. AI pipeline produces tight lists. No normalization layer existed."
  artifacts:
    - path: "src/lib/content/normalize-markdown.ts"
      issue: "Created: remark-based normalizer with tight-list plugin and trimEnd"
    - path: "src/app/api/articles/[id]/save/route.ts"
      issue: "Added normalization before storing + no-op version detection"
    - path: "src/lib/ai/pipeline.ts"
      issue: "Added normalization before storing AI markdown"
    - path: "src/app/api/articles/[id]/versions/route.ts"
      issue: "Added normalization in API response for old data compatibility"
    - path: "src/app/globals.css"
      issue: "Editor styling: prose-matched heading sizes, block spacing, side menu heights"
  missing: []
  debug_session: ".planning/debug/markdown-diff-divergence.md"
