# Roadmap: CodeWiki

## Overview

CodeWiki delivers an AI-augmented internal wiki that auto-generates documentation from source code while preserving human edits. The roadmap progresses from infrastructure and auth, through code sync and AI processing (the core differentiator), to the wiki viewer, editing, collaboration features, and interactive AI. Seven phases deliver 77 v1 requirements in dependency order, each producing a verifiable vertical slice.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - Database schema, Docker deployment, Google OIDC login, role system
- [x] **Phase 2: Admin Settings & GitHub Sync** - Admin dashboard, site_settings, GitHub file sync with cron-triggered scheduling
- [x] **Phase 3: AI Processing Pipeline** - Code analysis, article generation, merge strategy with conflict detection
- [x] **Phase 4: Wiki Viewer** - Category navigation, article rendering, full-text search, dashboard
- [ ] **Phase 5: Article Editing & Version History** - WYSIWYG editor, image handling, version tracking with diff and rollback
- [ ] **Phase 6: Technical View, Comments & Mentions** - Source file/DB table linking, threaded comments, @mentions
- [x] **Phase 7: Ask AI & Notifications** - Global and page-level AI chat, Slack/email notifications
- [ ] **Phase 8: AI Prompt Refinement & Category Strategy** - Consistent category creation rules, article content formatting, prompt hardening against run-to-run drift

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: Users can log in via Google, the database schema supports all downstream features, and the app runs in Docker
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can log in with their Google account and see a logged-in state
  2. First user to log in is automatically an admin; subsequent users are regular users
  3. Admin can promote a regular user to admin and demote an admin to user
  4. User can edit their display name and avatar from a profile page
  5. The application starts in Docker with persistent image storage and connects to Neon Postgres (pooled and unpooled)
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Next.js 15 project, complete Drizzle schema (18 tables), Docker infrastructure
- [x] 01-02-PLAN.md -- NextAuth v5 Google OIDC with split config, JWT roles, login page, admin user management
- [x] 01-03-PLAN.md -- User profile editing (name, avatar) and notification preferences UI

### Phase 2: Admin Settings & GitHub Sync
**Goal**: Admin can configure the system and sync source code from GitHub on a schedule or manually
**Depends on**: Phase 1
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, GHUB-01, GHUB-02, GHUB-03, GHUB-04, GHUB-05, GHUB-06, GHUB-07, GHUB-08, GHUB-09
**Success Criteria** (what must be TRUE):
  1. Admin can configure GitHub repo URL, API keys (OpenRouter, SendGrid, Slack), and AI prompts from a settings dashboard -- secret values are never exposed in the frontend
  2. Admin can browse the repo file tree with all files/folders excluded by default, and selectively include what to sync -- inclusions persist across syncs
  3. When a sync detects new files/folders in the repo (not previously seen), they appear in a "New Files Review" admin section -- unselected by default, separate from the main file tree
  4. Admin can review new files/folders and either include them (add to sync) or ignore them (permanently dismissed in DB, won't resurface). An "Apply Updates" action commits selections and triggers an AI import and re-index of wiki structure.
  5. When included files/folders change (via new file review or manual file tree edits), an AI re-index runs to determine if the wiki structure (categories, article groupings) needs updating
  6. Admin can trigger a manual sync that fetches changed files incrementally (SHA comparison), with a progress indicator
  7. Scheduled sync runs automatically via cron-triggered API route using admin-configured schedule, with concurrency locking
  8. Admin can view sync history and job status (pending, running, completed, failed) in the admin UI
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md -- Admin settings dashboard with tabbed UI (General, API Keys, AI Prompts), settings library, test connection
- [x] 02-02-PLAN.md -- GitHub integration: Octokit client, file tree UI with inclusion checkboxes, new files review section with include/ignore + "Apply Updates", incremental sync engine with concurrency lock
- [x] 02-03-PLAN.md -- Cron-triggered sync scheduling with schedule checker, enhanced sync history dashboard

### Phase 3: AI Processing Pipeline
**Goal**: The system automatically generates and updates wiki articles from code changes, merging AI content with human edits without destroying them
**Depends on**: Phase 2
**Requirements**: AIPL-01, AIPL-02, AIPL-03, AIPL-04, AIPL-05, AIPL-06, AIPL-07, AIPL-08
**Success Criteria** (what must be TRUE):
  1. After a sync completes, the system analyzes changed files and creates or updates articles with AI-generated content, technical view content, file links, and DB table mappings
  2. AI receives the full existing category tree and article index as context -- it must place articles into existing categories/groupings whenever possible, only proposing new categories when no existing one fits. Category coherence is critical to wiki organization.
  3. AI-generated articles follow the admin-configured article style prompt
  4. When an article with human edits is updated by AI, human contributions are preserved through the merge strategy -- the resulting article contains both the new AI content and the original human edits
  5. When a merge produces a conflict between human edits and code changes, a visible review banner appears on the article
  6. User can dismiss the review banner after reviewing the changes
**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md -- AI client (Vercel AI SDK + OpenRouter), Zod schemas, prompt builders, file content fetching, code analysis and article generation
- [x] 03-02-PLAN.md -- Three-way merge (node-diff3), conflict resolution, BlockNote conversion, version tracking, review banner dismissal API
- [x] 03-03-PLAN.md -- Pipeline orchestrator wiring analysis + merge + storage, sync integration (auto-trigger after sync)
- [x] 03-04-PLAN.md -- Gap closure: dynamic import for markdown.ts in pipeline.ts to fix createContext crash

### Phase 4: Wiki Viewer
**Goal**: Users can browse, navigate, and search the wiki to find and read articles
**Depends on**: Phase 3 (articles must exist to display)
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, VIEW-08, VIEW-09, VIEW-10
**Success Criteria** (what must be TRUE):
  1. User can navigate articles via a collapsible category/article tree in the left sidebar and breadcrumbs showing the article path
  2. Article content renders from Markdown with syntax-highlighted code blocks, and an auto-generated table of contents appears from article headings
  3. Each article has a tab system (Article, Technical View, Comments, History) and a metadata sidebar showing last updated, editor, AI/human badge, and category
  4. Admin can regenerate any article from its page — re-fetches the article's linked source files from GitHub and re-runs AI generation with the current prompt. Uses merge strategy if article has human edits, direct overwrite if AI-only.
  5. User can search articles with full-text search (tsvector), see highlighted results ranked by relevance, and results update as they type (debounced)
  6. Home page shows recent updates, a search bar, and bookmarked articles; layout is responsive with sidebar collapsing on mobile
**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md -- App shell layout with SidebarProvider, collapsible category/article tree, breadcrumbs, data access layer, dependency installation
- [x] 04-02-PLAN.md -- Article page with Markdown rendering (shiki syntax highlighting), TOC, tab system, metadata sidebar, admin Regenerate Article action
- [x] 04-03-PLAN.md -- Full-text search (tsvector) with debounced input, home dashboard with recent updates and bookmarks, user_bookmarks table
- [x] 04-04-PLAN.md -- Gap closure: category listing page and breadcrumb link fix
- [x] 04-05-PLAN.md -- Gap closure: BookmarkButton component on article pages

### Phase 5: Article Editing & Version History
**Goal**: Users can edit articles with a rich editor, upload images, and track all changes with full version history
**Depends on**: Phase 4
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, VERS-01, VERS-02, VERS-03, VERS-04, VERS-05
**Success Criteria** (what must be TRUE):
  1. User can edit any article in a WYSIWYG editor (BlockNote) with toolbar support for headings, bold, italic, code, links, tables, lists, and images -- editor stores native BlockNote JSON
  2. User can paste or upload images that are auto-compressed (max 1200x1200, JPEG quality 80, EXIF stripped) and stored on local filesystem, served via API route
  3. Editor auto-saves drafts as version records with `changeSource: "draft"` (one draft per user per article, upsert pattern). Drafts appear in version history with a distinct visual style. No more localStorage blind-restore — user can preview the draft before deciding to continue editing or discard it.
  4. User can view full version history for any article, filter by change source (AI, human, merged, draft), and compare any two versions with side-by-side or inline diff
  5. User can click any version history record to preview it as rendered formatted text in a slide-out panel — view it without restoring or comparing
  6. User can restore (rollback) any article to a previous version
  7. After AI merges a human-edited article, an LLM review pass analyzes the merged content against the code changes for semantic issues (contradictions, stale info). It never modifies content — it creates annotations in an `ai_review_annotations` table referencing section headings, with severity and timestamp.
  8. Article page shows a collapsible "AI Review: N items need attention" banner when active annotations exist. Each annotation card shows the concern, referenced section, timestamp, and a Dismiss button. Referenced section headings get a yellow left-border highlight. Clicking an annotation scrolls to that section.
  9. User can toggle between auto (system default), light, and dark mode from their profile page. Preference persists in the users table. Theme applies app-wide via next-themes ThemeProvider.
  10. Admin has a centralized "Review Queue" page listing all articles needing attention — merge conflicts (needsReview) and active AI review annotations. Each item links to the article. Filterable by category and searchable by article title/text. Sorted by most recent first, with configurable sort order.
**Plans:** 8 plans

Plans:
- [x] 05-01-PLAN.md -- BlockNote editor integration with native JSON storage, localStorage drafts, save with version tracking
- [x] 05-02-PLAN.md -- Image upload/paste with sharp compression, filesystem storage, and serving API
- [x] 05-03-PLAN.md -- Version history UI with source filtering, diff viewer (inline + side-by-side), and rollback
- [x] 05-04-PLAN.md -- AI review annotations: ai_review_annotations table, LLM review pass after merge, annotation banner UI with section highlighting and dismiss
- [x] 05-05-PLAN.md -- Admin Review Queue: centralized list of merge conflicts + AI review annotations, with category filter, search, and sort
- [x] 05-06-PLAN.md -- Draft-as-version: replace localStorage drafts with `changeSource: "draft"` version records (one per user per article, upsert), add "draft" to changeSourceEnum, update history UI with draft styling
- [x] 05-07-PLAN.md -- Version preview slide-out: click any version history record to view rendered formatted text in a slide-out panel without restoring
- [x] 05-08-PLAN.md -- Light/dark mode: next-themes ThemeProvider in root layout, theme toggle in user profile (auto/light/dark), persist preference in users table

### Phase 6: Technical View, Comments & Mentions
**Goal**: Users can see how articles relate to source code, discuss content in threaded comments, and mention colleagues
**Depends on**: Phase 5
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-04, CMNT-01, CMNT-02, CMNT-03, CMNT-04, CMNT-05, CMNT-06
**Success Criteria** (what must be TRUE):
  1. Technical View tab shows related source files with AI-generated relevance explanations and clickable GitHub deep links, plus related DB tables with column details and relevance notes
  2. User can click any linked source file to view its code inline in a syntax-highlighted code viewer (fetched from GitHub on-demand), without leaving the wiki
  3. Technical view content is editable using the same Markdown editor as articles
  4. User can post threaded comments on any article, with Markdown rendering, avatars, display names, and timestamps
  5. User can resolve and unresolve comments; @mention autocomplete triggers when typing @ and creates mention records that trigger notifications
  6. Admin can configure a separate OpenRouter "summary model" (efficient, fast model for short outputs) and a file summary prompt in settings. Each source file in `github_files` has an `aiSummary` column with a 1-2 sentence AI-generated description of what the file does. Summaries are generated/updated automatically during sync whenever a file is new or changed. Technical View file cards display the file's `aiSummary` instead of generic text. The summary model is reusable for other short-summary needs across the app.
**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md -- Technical view tab with structured file links, inline code viewer, DB tables, GitHub deep links, and technical view editing
- [x] 06-02-PLAN.md -- Threaded comments with Markdown rendering, resolve/unresolve, @mention autocomplete via react-mentions-ts
- [x] 06-03-PLAN.md -- AI file summaries: summary model setting, file_summary_prompt, github_files.aiSummary column, sync pipeline integration, Technical View card update

### Phase 7: Ask AI & Notifications
**Goal**: Users can ask AI questions about the wiki and codebase, and receive notifications about activity that matters to them
**Depends on**: Phase 6
**Requirements**: ASKI-01, ASKI-02, ASKI-03, ASKI-04, ASKI-05, ASKI-06, ASKI-07, NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06
**Success Criteria** (what must be TRUE):
  1. User can open a global Ask AI panel from any page that receives the wiki article index as context, with streaming Markdown responses
  2. User can open a page-level Ask AI scoped to the current article, its technical view, source files, and DB tables, with a context indicator showing what was used
  3. AI conversations are persisted per user (global and per-article); user can continue, start new, or delete conversations
  4. User receives Slack DM and/or email notifications for @mentions, new comments on articles they have interacted with, AI sync updates to articles they edited, and AI conflict flags -- based on their configured preferences
  5. Admin can configure Slack bot token and SendGrid API key with test buttons that send a test notification
**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md -- Global Ask AI chat panel with streaming markdown, shared chat components, conversation CRUD, header trigger
- [x] 07-02-PLAN.md -- Page-level Ask AI with article context assembly and context indicator
- [x] 07-03-PLAN.md -- Notification service (Slack DM, SendGrid email) with test buttons and all four trigger points wired

### Phase 8: AI Prompt Refinement & Category Strategy
**Goal**: The AI pipeline produces consistent, predictable category structures and well-formatted article content across every run — no drift in how categories are created or how articles are structured
**Depends on**: Phase 3 (AI pipeline must exist), Phase 5 (article rendering must exist for CSS fixes)
**Requirements**: Derived from production observations — not original spec requirements but critical to real-world quality
**Success Criteria** (what must be TRUE):
  1. The AI analysis prompt includes an explicit, deterministic category strategy: clear rules for when to reuse an existing category vs. create a new one, how to name categories, when a code folder maps to one category vs. multiple articles in one category, and how to handle subcategories. The strategy is informed by analysis of existing data.
  2. The AI article style prompt explicitly instructs the LLM to never start article content with the article title (since the title is rendered separately above the content). The first line of generated markdown should be the first content section heading or introductory text, not a duplicate of the title.
  3. Article content always uses H1 (`#`) as the top-level section heading within articles. The CSS sizing for H1 in prose/article content is reduced so it is visually smaller than the article title (`text-3xl font-bold`), creating a clear hierarchy: article title > H1 section heading > H2 sub-heading.
  4. The prompts include explicit structural rules: articles start with H1 section headings (not H2), each major section uses H1, sub-sections use H2, and no heading level is skipped.
  5. Run-to-run consistency: given the same set of source files and the same existing category tree, the AI produces the same category assignments and article groupings. The prompt includes anchoring instructions (prefer existing patterns, match naming conventions already in use) to minimize non-deterministic drift.
**Plans:** 4 plans

Plans:
- [ ] 08-01-PLAN.md -- Category strategy: analyze existing data, define deterministic category rules, update analysis prompt with explicit category creation/reuse strategy
- [ ] 08-02-PLAN.md -- Article content formatting: no title duplication rule, heading hierarchy (H1 sections), CSS size reduction for prose H1/H2, structural heading rules in style prompt
- [ ] 08-03-PLAN.md -- Show default prompt text in admin settings AI Prompts textareas (not blank when unconfigured)
- [ ] 08-04-PLAN.md -- Sync page: live log panel via SSE during manual sync, file tree expand/collapse all + default collapsed + search filter

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation & Authentication | 3/3 | ✓ Complete | 2026-02-13 |
| 2. Admin Settings & GitHub Sync | 3/3 | ✓ Complete | 2026-02-13 |
| 3. AI Processing Pipeline | 4/4 | ✓ Complete | 2026-02-13 |
| 4. Wiki Viewer | 5/5 | ✓ Complete | 2026-02-13 |
| 5. Article Editing & Version History | 8/8 | ✓ Complete | 2026-02-14 |
| 6. Technical View, Comments & Mentions | 3/3 | ✓ Complete | 2026-02-14 |
| 7. Ask AI & Notifications | 3/3 | ✓ Complete | 2026-02-14 |
| 8. AI Prompt Refinement & Category Strategy | 0/4 | Not started | - |
