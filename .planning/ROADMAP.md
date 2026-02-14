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
- [ ] **Phase 7: Ask AI & Notifications** - Global and page-level AI chat, Slack/email notifications

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
  3. Editor auto-saves drafts to localStorage; explicit Save creates a version record, sets the human-edited flag, and prompts for an optional change summary
  4. User can view full version history for any article, filter by change source (AI, human, merged), and compare any two versions with side-by-side or inline diff
  5. User can restore (rollback) any article to a previous version
  6. After AI merges a human-edited article, an LLM review pass analyzes the merged content against the code changes for semantic issues (contradictions, stale info). It never modifies content — it creates annotations in an `ai_review_annotations` table referencing section headings, with severity and timestamp.
  7. Article page shows a collapsible "AI Review: N items need attention" banner when active annotations exist. Each annotation card shows the concern, referenced section, timestamp, and a Dismiss button. Referenced section headings get a yellow left-border highlight. Clicking an annotation scrolls to that section.
**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md -- BlockNote editor integration with native JSON storage, localStorage drafts, save with version tracking
- [x] 05-02-PLAN.md -- Image upload/paste with sharp compression, filesystem storage, and serving API
- [x] 05-03-PLAN.md -- Version history UI with source filtering, diff viewer (inline + side-by-side), and rollback
- [x] 05-04-PLAN.md -- AI review annotations: ai_review_annotations table, LLM review pass after merge, annotation banner UI with section highlighting and dismiss

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
**Plans**: TBD

Plans:
- [ ] 06-01: Technical view tab (file links with inline code viewer, DB tables, GitHub deep links)
- [ ] 06-02: Threaded comments with Markdown, resolve/unresolve, and @mentions

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
**Plans**: TBD

Plans:
- [ ] 07-01: Global Ask AI chat panel with streaming and conversation persistence
- [ ] 07-02: Page-level Ask AI with article context assembly
- [ ] 07-03: Notification service (Slack DM, SendGrid email) with preference-based routing

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation & Authentication | 3/3 | ✓ Complete | 2026-02-13 |
| 2. Admin Settings & GitHub Sync | 3/3 | ✓ Complete | 2026-02-13 |
| 3. AI Processing Pipeline | 4/4 | ✓ Complete | 2026-02-13 |
| 4. Wiki Viewer | 5/5 | ✓ Complete | 2026-02-13 |
| 5. Article Editing & Version History | 4/4 | ✓ Complete | 2026-02-13 |
| 6. Technical View, Comments & Mentions | 0/2 | Not started | - |
| 7. Ask AI & Notifications | 0/3 | Not started | - |
