---
status: complete
phase: 03-ai-processing-pipeline
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md
started: 2026-02-13T22:00:00Z
updated: 2026-02-13T22:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sync Triggers AI Pipeline and Creates Articles
expected: Triggering a manual sync (with GitHub repo configured and files included) returns sync stats that include articlesCreated > 0. After sync, the articles table contains new rows with title, slug, contentJson (BlockNote JSON), and a category assignment.
result: issue
reported: "ok i see the new rows in github_files after clicking the Run Manual Sync button but i dont see any records in either of those tables, articles and articleversions"
severity: major

### 2. AI Uses Existing Category Tree Context
expected: When articles are generated, the AI receives the full category tree and article index. Created articles are placed into existing categories when a suitable one exists, rather than always creating new categories.
result: skipped
reason: Blocked by Test 1 -- pipeline crashes before article generation (createContext error)

### 3. Article File Links and DB Table Mappings Populated
expected: After sync creates articles, the article_file_links table has entries linking each article to its relevant source files. If DB tables are referenced, article_db_tables entries exist as well.
result: skipped
reason: Blocked by Test 1 -- no articles created

### 4. AI-Only Articles Overwritten on Re-sync
expected: Running sync a second time (no human edits made) updates existing AI-generated articles in place rather than creating duplicate articles. The hasHumanEdits flag remains false.
result: skipped
reason: Blocked by Test 1 -- no articles created

### 5. Human-Edited Articles Use Three-Way Merge
expected: If an article has hasHumanEdits=true and AI produces new content, the merge engine runs three-way merge using node-diff3. The resulting article preserves human contributions alongside new AI content.
result: skipped
reason: Blocked by Test 1 -- no articles created

### 6. Merge Conflict Sets Review Flag
expected: When three-way merge detects a conflict between human edits and AI changes, the article's needsReview flag is set to true. The human version is kept as the article content, and the AI proposal is stored as a version record.
result: skipped
reason: Blocked by Test 1 -- no articles created

### 7. Dismiss Review API Endpoint Works
expected: POST /api/articles/[id]/dismiss-review (authenticated) returns 200 and clears the needsReview flag on the article. Subsequent GET shows needsReview=false.
result: skipped
reason: Blocked by Test 1 -- no articles exist to dismiss review on

### 8. Pipeline Failure Does Not Abort Sync
expected: If the AI pipeline encounters an error (e.g., the createContext crash), the sync still completes successfully. The sync_logs record shows status "completed" and github_files are updated. Errors are logged to console but sync is not aborted.
result: pass

## Summary

total: 8
passed: 1
issues: 1
pending: 0
skipped: 6

## Gaps

- truth: "After sync completes, articles table contains new rows with AI-generated content, title, slug, contentJson, and category assignment"
  status: failed
  reason: "User reported: ok i see the new rows in github_files after clicking the Run Manual Sync button but i dont see any records in either of those tables, articles and articleversions. Root cause: pipeline.ts statically imports markdown.ts which imports @blocknote/server-util causing createContext crash in RSC/Turbopack environment. Dynamic import in sync.ts is not deep enough."
  severity: major
  test: 1
  artifacts:
    - path: "src/lib/ai/pipeline.ts"
      issue: "Line 26: static import of markdown.ts pulls in @blocknote/server-util at module evaluation time"
    - path: "src/lib/content/markdown.ts"
      issue: "Line 1: top-level import of @blocknote/server-util triggers JSDOM createContext in RSC"
  missing:
    - "pipeline.ts must dynamically import markdown.ts (same pattern as sync.ts dynamically importing pipeline.ts)"
