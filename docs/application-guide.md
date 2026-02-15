# Ultra Wiki Application Guide

> **Version:** 1.0.0
> **Last Updated:** 2026-02-14

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Getting Started](#3-getting-started)
4. [Authentication & Users](#4-authentication--users)
5. [Admin Configuration](#5-admin-configuration)
6. [GitHub Sync](#6-github-sync)
7. [AI Pipeline](#7-ai-pipeline)
8. [Content Merge Strategy](#8-content-merge-strategy)
9. [Wiki Navigation & Search](#9-wiki-navigation--search)
10. [Article Viewing](#10-article-viewing)
11. [Article Editing](#11-article-editing)
12. [Version History](#12-version-history)
13. [Technical View](#13-technical-view)
14. [Comments & Mentions](#14-comments--mentions)
15. [Ask AI](#15-ask-ai)
16. [Notifications](#16-notifications)
17. [Database Schema](#17-database-schema)
18. [API Routes Reference](#18-api-routes-reference)

---

## 1. Project Overview

### Problem

Internal teams working on a large monolith application lack a living, accurate source of truth for how modules, features, and components work. Documentation goes stale, and manual upkeep is unsustainable.

### Solution

**Ultra Wiki** is a self-hosted, AI-augmented internal wiki that:

- **Automatically generates and updates documentation:** Creates and refreshes wiki articles from folders and files you specify in the monolith pulled from GitHub
- **AI + human co-existence, by design:** Humans can edit, comment, and annotate alongside AI-generated content, and user edits are first-class citizens that are never silently overwritten
- **Scheduled, code-driven refresh:** On a predefined schedule, AI re-updates articles when code changes, and any updates that require changes in documentation are flagged for review
- **Developer view for deeper traceability:** Dive from any article into the related source files and database tables, providing engineering-friendly context
- **Full version history, built in:** Every change is tracked so you can compare versions, view diffs, and restore prior versions when needed
- **Ask AI anywhere:** Global app-level and per-article Q&A for quick, contextual answers

### Key Principles

- **Human-first, AI-assisted:** AI accelerates drafting and ongoing updates, but human edits are prioritized, preserved, and never silently overwritten
- **Privacy-first AI:** No training on data and no data retention when AI services are used
- **Open-source first:** Use highly-adopted, well-starred open-source libraries and tools wherever possible
- **Markdown-native:** All content stored as raw Markdown in the database — no proprietary formats

### Target Users

- Developers
- QA Engineers
- Product Managers

---

## 2. Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 (App Router, React 19) | Full-stack React framework, SSR, API routes, widely adopted |
| UI | shadcn/ui + Tailwind CSS v4 | High-quality, customizable components |
| Database | Neon Postgres (serverless) | Connection string configured in admin settings |
| ORM | Drizzle ORM | Type-safe, lightweight, great Postgres support |
| Auth | NextAuth.js v5 (Auth.js) with Google OIDC | Session management, widely adopted |
| AI | Vercel AI SDK v6 + OpenRouter | Model-agnostic; per-prompt model + reasoning effort configurable in admin |
| Editor | BlockNote (WYSIWYG block editor) | Modern block-based editor, great UI, active development |
| Markdown Rendering | react-markdown v10 + remark-gfm + rehype-shiki | Mature pipeline with plugin support |
| GitHub API | Octokit (@octokit/rest) | Official GitHub SDK |
| Image Processing | sharp | High-performance resizing and compression |
| Diff | diff (npm) + node-diff3 | diff for version history display, node-diff3 for three-way merge |
| Search | Postgres full-text search (tsvector) | Built-in, no extra infrastructure needed |
| Notifications | Raw fetch() to Slack and SendGrid REST APIs | Direct HTTP calls, no third-party notification libraries |
| Job Scheduling | Cron-triggered API route | Host cron hits sync endpoint with bearer token auth |

### Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login page
│   │   └── login/
│   ├── (admin)/          # Admin pages (settings, sync, users, review queue)
│   │   └── admin/
│   │       ├── settings/
│   │       ├── sync/
│   │       ├── users/
│   │       ├── review-queue/
│   │       ├── ai-prompts/
│   │       └── api-keys/
│   ├── (wiki)/           # Wiki pages (articles, search, profile, home)
│   │   ├── wiki/
│   │   │   ├── [articleSlug]/
│   │   │   └── category/[categorySlug]/
│   │   ├── search/
│   │   └── profile/
│   ├── (docs)/           # Documentation viewer
│   │   └── docs/
│   └── api/              # API routes
│       ├── admin/
│       ├── articles/
│       ├── chat/
│       ├── conversations/
│       ├── github/
│       ├── images/
│       ├── sync/
│       └── users/
├── components/
│   ├── admin/            # Admin-specific components
│   ├── chat/             # Ask AI components
│   ├── common/           # Shared components (user menu, theme)
│   ├── editor/           # BlockNote editor components
│   ├── ui/               # shadcn/ui primitives
│   └── wiki/             # Wiki viewer components
└── lib/
    ├── ai/               # AI pipeline (analyze, generate, plan, merge, review)
    ├── auth/             # NextAuth configuration
    ├── db/               # Drizzle schema, migrations, seed
    ├── github/           # GitHub sync engine, tree, retry logic
    ├── merge/            # Three-way merge and conflict resolution
    ├── notifications/    # Slack DM and email delivery
    ├── settings/         # Key-value settings store
    └── wiki/             # Wiki queries and server actions
```

### Route Groups

- `(auth)` — Login page. No layout chrome.
- `(admin)` — Admin pages. Protected by admin role check. Header with settings navigation.
- `(wiki)` — Wiki pages. Protected by authentication. Full layout with sidebar, search, and header.
- `(docs)` — Documentation viewer. Standalone layout for viewing `/docs/*.md` files.
- `api/` — REST API routes for mutations, streaming, and data access.

### Content Storage

Articles use a dual-format storage model:

- **Markdown** (`content_markdown`) — The canonical format. Used by the AI pipeline for generation, merging, and analysis. Stored in both the `articles` and `article_versions` tables.
- **BlockNote JSON** (`content_json`) — Used by the WYSIWYG editor for rich editing. Generated client-side when a user opens the editor. Stored alongside markdown on save. Reset to `null` when AI regenerates an article.

When viewing an article, the server renders `content_markdown` directly via react-markdown. When editing, the client loads `content_json` if available, otherwise parses `content_markdown` into BlockNote blocks on the fly.

### Deployment

- Self-hosted on a private server (Docker recommended)
- Docker Compose file with: Next.js app (single container, node:22-alpine base)
- Neon Postgres is remote; connection string provided via `DATABASE_URL` environment variable
- Local volume mount for image storage (`/data/images`)
- Host cron job for scheduled syncs

---

## 3. Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose (for production deployment)
- A Neon Postgres database
- Google OAuth credentials (client ID and secret)
- An OpenRouter API key

### Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres pooled connection string |
| `DATABASE_URL_UNPOOLED` | Yes | Neon Postgres direct connection string (used for migrations) |
| `AUTH_SECRET` | Yes | NextAuth.js secret. Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `AUTH_URL` | Yes | Application base URL (e.g., `http://localhost:3000`) |
| `CRON_SECRET` | Yes | Bearer token for the cron sync endpoint. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | No | Public-facing URL for links in notifications |

All other configuration (GitHub repo, OpenRouter API key, AI prompts, notification keys) is managed through the admin settings UI and stored in the `site_settings` database table.

### Local Development

```bash
npm install
npm run db:generate     # Generate Drizzle migration files
npm run db:migrate      # Apply migrations to Neon
npm run db:seed         # Seed site_settings with default keys
npm run dev             # Start development server at http://localhost:3000
```

### Docker Deployment

```bash
docker-compose up --build -d
```

The `docker-compose.yml` defines a single service that:
- Builds from the multi-stage `Dockerfile` (node:22-alpine base)
- Maps port 3000
- Mounts a `image_data` volume at `/data/images` for uploaded article images
- Reads environment from `.env`

For scheduled syncs, set up a host cron job that hits the sync endpoint:

```
*/5 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/admin/sync/cron
```

The endpoint checks the admin-configured cron schedule internally, so the host cron can run frequently.

### First-Time Setup

1. Start the application and navigate to the login page
2. Sign in with Google — the first user is automatically promoted to admin
3. Go to **Admin > Settings** and configure:
   - **API Keys** — Enter your OpenRouter API key and GitHub personal access token
   - **General** — Set the GitHub repository URL and branch
4. Go to **Admin > Sync** to see the repository file tree
5. Use the checkboxes to include or exclude files and folders
6. Click **Sync Now** to trigger the first sync, which fetches files and runs the AI pipeline

---

## 4. Authentication & Users

### Login

Ultra Wiki uses Google OIDC as the sole authentication method, configured through NextAuth.js v5 with JWT session strategy. The login page is at `/login`.

### Role System

| Role | Capabilities |
|------|-------------|
| **Admin** | Everything a user can do, plus: admin settings, user management, manual sync, prompt editing, file inclusion management, article regeneration |
| **User** | View wiki, edit articles, comment, Ask AI, manage bookmarks, configure notification preferences |

The first user to sign in is automatically promoted to admin. Admins can promote or demote other users from the **Admin > Users** page.

### User Profile

Available at `/profile`:

- **Display name** — Editable
- **Custom avatar URL** — Override the Google avatar
- **Theme preference** — System, Light, or Dark (uses `next-themes`)
- **Notification preferences** — Slack, email, mention, and activity toggles (see [Notifications](#16-notifications))

---

## 5. Admin Configuration

The admin dashboard is at `/admin/settings` with three tabs:

### General Settings

- **GitHub Repository URL** — Full URL (e.g., `https://github.com/org/repo`)
- **GitHub Branch** — Branch to sync from (default: `main`)
- **Sync Schedule** — Cron expression with a human-readable preview via cronstrue

### API Keys

- **GitHub Personal Access Token** — For repository read access (masked in UI)
- **OpenRouter API Key** — For AI model access (masked in UI)
- **SendGrid API Key** — For email notifications (masked in UI)
- **SendGrid From Email** — Sender address for notification emails
- **Slack Bot Token** — For Slack DM notifications (masked in UI)
- **Test Connection** buttons for GitHub and notification services

### AI Prompts

Each prompt type has:
- A textarea for custom prompt text (pre-filled with the default prompt if empty)
- A model selector (separate model per prompt type)
- A reasoning effort selector (none, minimal, low, medium, high, xhigh)

The five configurable prompts:

| Prompt | Purpose | Default Constant |
|--------|---------|-----------------|
| Analysis Prompt | Controls how code changes are analyzed and mapped to articles | `DEFAULT_ANALYSIS_PROMPT` |
| Article Style Prompt | Governs article writing tone, structure, and formatting rules | `DEFAULT_ARTICLE_STYLE_PROMPT` |
| File Summary Prompt | Instructions for generating 1-2 sentence file descriptions | `DEFAULT_FILE_SUMMARY_PROMPT` |
| Global Ask AI Prompt | System prompt for wiki-wide Ask AI conversations | `DEFAULT_ASK_AI_GLOBAL_PROMPT` |
| Page Ask AI Prompt | System prompt for article-scoped Ask AI conversations | `DEFAULT_ASK_AI_PAGE_PROMPT` |

All prompt defaults are defined in `src/lib/ai/prompts.ts` and exported for reuse. When a setting value is empty in the database, the pipeline falls back to the corresponding default constant.

---

## 6. GitHub Sync

### How Sync Works

The sync engine in `src/lib/github/sync.ts` performs incremental synchronization:

1. **Acquire lock** — Atomic `INSERT NOT EXISTS` on `sync_logs` prevents concurrent syncs
2. **Fetch tree** — Pulls the repository file tree from the GitHub API
3. **Detect changes** — Compares file SHAs against the previously cached tree to identify added, modified, and removed files
4. **Filter** — Applies inclusion rules from the `excluded_paths` table (repurposed as an inclusion-path store)
5. **Run AI pipeline** — Sends changed files through the analysis/generation pipeline (see [AI Pipeline](#7-ai-pipeline))
6. **Release lock** — Updates `sync_logs` with completion status and statistics

### Manual Sync

The **Admin > Sync** page provides:

- **Sync Now** button that triggers a sync via the SSE endpoint (`GET /api/sync/stream`)
- **Live log** streaming progress messages in real time via Server-Sent Events
- **Sync history** showing the last 20 sync operations with status, trigger type, file/article counts, and timestamps

### Scheduled Sync

A host cron job calls `POST /api/admin/sync/cron` with a `Bearer` token (`CRON_SECRET`). The endpoint:
1. Validates the bearer token
2. Checks `isSyncDue()` against the admin-configured cron schedule
3. If due, calls `runSync("scheduled")` and returns results
4. If not due, returns `{skipped: true}`

### File Tree Management

The file tree UI at `/admin/sync` shows the full repository structure with:

- **Checkboxes** — Include or exclude files and directories. Directories toggle all descendants. Three-state: checked, unchecked, indeterminate.
- **Search filter** — Real-time recursive matching, auto-expands tree during search
- **Expand/Collapse All** — Bulk tree controls
- **Save Inclusions** — Persists the selected paths via `saveIncludedPaths()` server action

---

## 7. AI Pipeline

The pipeline converts source code files into wiki articles. It has two modes based on the size of the change set:

- **Fast path** — 25 or fewer files and under 50K total characters. Sends all files directly to the analysis model in a single call.
- **Multi-stage pipeline** — Larger change sets. Runs a 3-stage process: Summarize → Plan → Analyze.

### Multi-Stage Pipeline

**Stage 1 (Summarize):** Each file gets a 1-2 sentence AI summary using the configured summary model. Runs with concurrency of 5. Summaries are saved to `github_files.ai_summary`.

**Pre-Stage 2 (Resolve Links):** Queries the database to find which files are already linked to existing articles via `article_file_links`.

**Stage 2 (Plan):** Groups files into 5-15 coherent clusters using directory-level compression. The LLM receives compressed directory summaries (not individual files) and returns `directory_patterns` for each group plus `shared_context_patterns` for infrastructure files that provide context but shouldn't generate articles.

**Stage 3 (Analyze):** Each group is analyzed independently with the full analysis model (concurrency of 2). Each group's prompt includes compact one-line summaries of other groups and summaries of shared context files.

For a detailed technical description of the pipeline, including directory compression, plan expansion, compact plan context, and scaling characteristics, see [docs/ai-pipeline.md](ai-pipeline.md).

### Post-Analysis

After analysis, each proposed article is processed:

- **Create** — New article record with generated content, file links, and DB table references
- **Update (AI-only)** — Direct overwrite of content
- **Update (human-edited)** — Three-way merge to preserve human changes (see [Content Merge Strategy](#8-content-merge-strategy))

---

## 8. Content Merge Strategy

### AI-Only Articles

Articles that have never been human-edited (`has_human_edits = false`) are overwritten directly by the AI on each sync. A new version record is created with `change_source = "ai_updated"`.

### Human-Edited Articles

When a sync updates an article that has human edits, the system runs a three-way merge using `node-diff3`:

- **Base** — The last AI-generated version (most recent `ai_generated` or `ai_updated` version)
- **Current** — The article's current content (includes human edits)
- **Incoming** — The new AI-generated content

If the merge is clean (no conflicts):
- The merged content becomes the new article content
- A version record is created with `change_source = "ai_merged"`
- An optional AI review checks for semantic issues (see below)

If the merge has conflicts:
- The human version is kept as the article content
- The AI proposal is stored as a version record for reference
- The article is flagged with `needs_review = true`
- A notification is sent to the last human editor
- A review banner appears on the article page

### AI Review Annotations

After a clean three-way merge, the system optionally runs an AI review that checks for semantic issues — contradictions, stale information, or inconsistencies between the merged human and AI content.

Each annotation includes:
- **Section heading** — The heading the issue relates to
- **Concern** — Description of the issue
- **Severity** — info, warning, or error

Annotations are stored in the `ai_review_annotations` table and displayed as a collapsible banner on the article page with section-level highlighting. Any user can dismiss individual annotations.

### Admin Review Queue

The **Admin > Review Queue** page (`/admin/review-queue`) lists all articles that need attention:
- Articles with `needs_review = true` (merge conflicts)
- Articles with active (undismissed) AI annotations

The queue supports search by title, filtering by category, and sorting by date.

---

## 9. Wiki Navigation & Search

### Sidebar

The left sidebar (`AppSidebar` component) shows a collapsible category tree with nested articles. Categories are rendered as expandable folders, articles as document links. The active article is highlighted based on the current URL.

### Category Pages

Navigating to `/wiki/category/[categorySlug]` shows a category page with:
- Subcategories in a responsive grid (cards with optional emoji icons)
- Articles listed below subcategories
- Breadcrumb navigation back through the category hierarchy

### Breadcrumbs

Every article and category page shows breadcrumb navigation: **Home > Category Chain > Current Page**. All segments except the current page are clickable links.

### Search

The search input in the header bar uses debounced navigation (300ms) to `/search?q=term`:
- **Full-text search** powered by Postgres `tsvector` (auto-generated from article title and content)
- **Results** show title, category badge, highlighted snippet (with `<mark>` tags), and last updated date
- HTML is sanitized in snippets — only `<mark>` tags are preserved to prevent XSS

### Home Dashboard

The home page at `/` shows a two-column layout:
- **Recent Updates** — The 10 most recently updated articles with change source badges
- **Your Bookmarks** — Articles bookmarked by the current user

---

## 10. Article Viewing

### Article Page

Each article at `/wiki/[articleSlug]` shows:

- **Breadcrumb** navigation from Home through the category hierarchy
- **Metadata bar** — Last updated timestamp, AI/human badge, editor name and avatar, category
- **Merge conflict banner** — Yellow warning if `needs_review` is true, with a dismiss button
- **AI annotation banner** — Collapsible amber banner listing annotations with severity icons, section links, and dismiss buttons
- **Content area** — Markdown rendered via `MarkdownAsync` (react-markdown v10) with:
  - GitHub Flavored Markdown (remark-gfm)
  - Syntax highlighting via rehype-shiki with dual light/dark themes
  - Heading IDs generated by a shared `slugify` function for anchor linking
- **Table of contents** — Auto-generated from h1-h3 headings, shown in the sidebar

### Tab System

Each article page has four tabs:

1. **Article** — Main rendered content
2. **Technical View** — Related source files and database tables (see [Technical View](#13-technical-view))
3. **Comments** — Threaded discussion (see [Comments & Mentions](#14-comments--mentions))
4. **History** — Version history with diff viewer (see [Version History](#12-version-history))

### Actions

- **Bookmark** — Star icon toggles bookmark status with optimistic UI
- **Edit** — Opens the BlockNote editor (all authenticated users)
- **Regenerate** — Re-fetches source files and re-runs AI generation (admin only)
- **Ask AI** — Opens page-level Ask AI panel with article context

---

## 11. Article Editing

### BlockNote Editor

The editor at `/wiki/[articleSlug]/edit` uses BlockNote, a WYSIWYG block-based editor:

- **Loading strategy** — Loaded via `next/dynamic` with `ssr: false` to avoid server-side rendering issues
- **Content initialization** — Uses `content_json` if available, otherwise parses `content_markdown` client-side
- **Toolbar** — Headings, bold, italic, code, links, tables, lists, images
- **Theme** — Syncs with the app's light/dark mode via `useTheme()`

### Image Upload

Images can be pasted from the clipboard or uploaded via the editor's file picker:

1. Posted to `POST /api/articles/[id]/images` as FormData
2. Validated: 10 MB max size, MIME type must start with `image/`
3. Compressed with `sharp`: max 1200x1200 pixels, JPEG quality 80, EXIF stripped
4. Saved to `/data/images/{articleId}/{uuid}.jpg`
5. Recorded in the `article_images` table
6. Markdown reference inserted: `![image](/api/images/{articleId}/{filename})`

### Auto-Save Drafts

Drafts are saved server-side (not localStorage) with a 3-second debounce:

- One draft per user per article (upsert pattern)
- Stored as version records with `change_source = "draft"`
- On editor load, if a draft exists, a blue banner offers to restore or discard it
- On explicit save, the draft is deleted via a non-blocking DELETE call

### Saving

The save flow:

1. Editor exports `content_json` and `content_markdown`
2. **Optimistic locking** — The `loadedUpdatedAt` timestamp (from page load) is sent with the save request. If the article was modified elsewhere in the meantime, the server returns 409 Conflict.
3. A new `article_versions` record is created with `change_source = "human_edited"`
4. The article's `has_human_edits`, `last_human_edited_at`, and `last_human_editor_id` are updated
5. **No-op detection** — If the markdown content is unchanged (ignoring whitespace normalization), no version record is created

---

## 12. Version History

### Version List

The History tab shows all versions of an article with:
- Date/time, change source badge, creator name, change summary
- Filter buttons: All, AI Generated, Human Edited, AI Merged, AI Updated, Draft
- The latest version is marked with a "Latest" badge

### Diff Viewer

Select two versions to compare them:
- **Inline mode** — Unified view with red (removed) and green (added) highlighting
- **Side-by-side mode** — Two-column layout aligning old and new content
- Uses the `diff` library's `diffLines()` function for computation

### Version Preview

Click the eye icon on any version to open a slide-out panel (Sheet component, right side) showing:
- Version metadata (date, change source, creator, summary)
- Rendered markdown content via `MarkdownHooks` (react-markdown v10 client-side)

### Rollback

Select one version and click "Restore" to:
1. Replace the article's content with the selected version
2. Create a new version record with `change_source = "human_edited"` noting the restore
3. Clear the `needs_review` flag
4. No history is lost — the restore itself is tracked as a version

---

## 13. Technical View

The Technical View tab on each article shows the relationship between the article and the underlying codebase:

### Related Source Files

Each file card shows:
- File path
- AI-generated relevance explanation
- AI file summary (from Stage 1 of the pipeline)
- **View Code** button — Opens a dialog with syntax-highlighted source code (server-side shiki rendering via `/api/github/file-content`)
- **GitHub** link — Deep link to the file on GitHub

### Related Database Tables

Each table entry shows:
- Table name
- Column details (from JSON metadata)
- AI-generated relevance explanation

### Data Sources

- `article_file_links` — Maps articles to `github_files` records with relevance explanations
- `article_db_tables` — Maps articles to database table names with column metadata
- Both are populated during the AI analysis step and updated on each sync

---

## 14. Comments & Mentions

### Comments

The Comments tab on each article provides a threaded discussion:

- **Single-level threading** — Root comments can have replies, but replies cannot be nested further
- **Markdown support** — Comment bodies rendered with react-markdown
- **Resolve/unresolve** — Any user can toggle a comment's resolved status. Resolved comments show with a green left border.
- **User info** — Avatar, display name, and relative timestamp on each comment

### @Mentions

Type `@` in the comment input to trigger an autocomplete dropdown:

- User search via `/api/users/search?q=query`
- Powered by `react-mentions-ts` library
- Mention markup stored as `@[display](userId)` in the database
- Rendered as `**@display**` (bold) when viewing comments
- Each mention creates a record in the `mentions` table and triggers notifications

---

## 15. Ask AI

### Global Ask AI

Accessible from the header bar on any wiki page:

- Opens a slide-out chat panel (Sheet component)
- **Two-step context assembly:**
  1. Uses structured output to identify the 5 most relevant articles for the question
  2. Loads full content for selected articles
- **Context budget:** 32,000 characters total, split 70% article content / 30% technical view
- Streaming markdown responses via Server-Sent Events
- Conversation list with create, continue, and delete operations
- Conversations persisted in `ai_conversations` (mode: "global") and `ai_conversation_messages`

### Page-Level Ask AI

Button on each article page, scoped to the current article:

- Assembles context from: article content, technical view, related source files (with AI summaries), and related database tables
- **Context indicator** shows what information was included (article, technical view, file count, table count)
- Same streaming and conversation persistence as global mode
- Conversations stored with `mode = "page"` and `article_id` set

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/chat` | Global Ask AI streaming endpoint |
| `POST /api/chat/article` | Page-level Ask AI streaming endpoint |
| `GET /api/conversations` | List user's conversations |
| `POST /api/conversations` | Create new conversation |
| `GET /api/conversations/[id]` | Load conversation with messages |
| `DELETE /api/conversations/[id]` | Delete conversation |

---

## 16. Notifications

### Delivery Channels

**Slack DM** — Uses raw `fetch()` to the Slack `chat.postMessage` API. Bot token configured in admin settings. Users enter their Slack user ID in their profile.

**Email (SendGrid)** — Uses raw `fetch()` to the SendGrid v3 `mail/send` API. API key and from email configured in admin settings.

No third-party notification libraries are used — both channels use native `fetch()`.

### Notification Events

| Event | Recipients |
|-------|-----------|
| @mention in comment | The mentioned user |
| New comment on article | Previous commenters and last human editor |
| AI sync updated an article | The last human editor |
| AI merge conflict | The last human editor |

### User Preferences

Each user configures in their profile (`/profile`):

- **Slack notifications** — Enable/disable + Slack user ID
- **Email notifications** — Enable/disable
- **Notify on mention** — Toggle
- **Notify on activity** — Toggle (covers comments and sync updates)

### Behavior

All notifications are fire-and-forget — they never block the primary action. Slack and email delivery run in parallel via `Promise.allSettled()`. Failures are caught and logged but do not surface to the user.

Admin can test Slack and SendGrid configuration via the **Test** buttons on the API Keys settings page.

---

## 17. Database Schema

The schema is defined in `src/lib/db/schema.ts` using Drizzle ORM. There are 20 tables and 7 enums.

### Enums

- `role` — admin, user
- `change_source` — ai_generated, ai_updated, human_edited, ai_merged, draft
- `sync_status` — running, completed, failed
- `trigger_type` — scheduled, manual
- `ai_conversation_mode` — global, page
- `ai_message_role` — user, assistant
- `annotation_severity` — info, warning, error

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `email` | `text` UNIQUE NOT NULL | From Google OIDC |
| `name` | `text` | Display name |
| `avatar_url` | `text` | Profile picture URL (from Google or user-uploaded) |
| `role` | `enum('admin','user')` | Default: `'user'` |
| `notify_slack_enabled` | `boolean` | Default: `false` |
| `slack_user_id` | `text` | For DM notifications |
| `notify_email_enabled` | `boolean` | Default: `false` |
| `notify_on_mention` | `boolean` | Default: `true` |
| `notify_on_activity` | `boolean` | Default: `true` — notify when articles user has interacted with are updated |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `site_settings`

A key-value configuration table for admin-level settings. Secrets are masked in the admin UI — full values are never sent to the frontend.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` PK | |
| `key` | `text` UNIQUE NOT NULL | Setting key name |
| `value` | `text` | Stored as plain text (DB connection is TLS-encrypted via Neon) |
| `description` | `text` | Human-readable description |
| `updated_at` | `timestamptz` | |

**Settings keys (27 total):** `github_repo_url`, `github_branch`, `github_api_key`, `openrouter_api_key`, `openrouter_model`, `openrouter_reasoning_effort`, `openrouter_summary_model`, `openrouter_ask_ai_model`, `openrouter_ask_ai_reasoning_effort`, `sync_cron_schedule`, `sendgrid_api_key`, `sendgrid_from_email`, `slack_bot_token`, `analysis_prompt`, `analysis_prompt_model`, `analysis_prompt_reasoning_effort`, `article_style_prompt`, `file_summary_prompt`, `file_summary_prompt_model`, `file_summary_prompt_reasoning_effort`, `ask_ai_global_prompt`, `ask_ai_global_prompt_model`, `ask_ai_global_prompt_reasoning_effort`, `ask_ai_page_prompt`, `ask_ai_page_prompt_model`, `ask_ai_page_prompt_reasoning_effort`, `cached_repo_tree`.

### `github_files`

Tracks all files imported from the GitHub repo. Metadata only — file content is fetched from GitHub on demand.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `file_path` | `text` UNIQUE NOT NULL | Relative path from repo root |
| `file_sha` | `text` | Latest Git SHA for this file |
| `content_hash` | `text` | Hash of file content for change detection |
| `ai_summary` | `text` | AI-generated 1-2 sentence file description |
| `last_synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `excluded_paths`

Repurposed as an inclusion-path store. Each record represents a file path that is included in sync.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `pattern` | `text` UNIQUE NOT NULL | File path to include |
| `created_by` | `uuid` FK → `users.id` | |
| `created_at` | `timestamptz` | |

### `articles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `title` | `text` NOT NULL | Article title |
| `slug` | `text` UNIQUE NOT NULL | URL-friendly identifier |
| `content_markdown` | `text` NOT NULL | Current article body (raw Markdown) |
| `content_json` | `jsonb` | BlockNote JSON for WYSIWYG editing. Null when AI-generated; populated on human save. |
| `technical_view_markdown` | `text` | Technical view content — related files, DB tables, and explanations |
| `category_id` | `uuid` FK → `categories.id` | |
| `parent_article_id` | `uuid` FK → `articles.id` | For nested article hierarchy |
| `sort_order` | `integer` | For ordering within a category/parent |
| `last_ai_generated_at` | `timestamptz` | When AI last generated/updated this article |
| `last_human_edited_at` | `timestamptz` | When a human last edited this article |
| `last_human_editor_id` | `uuid` FK → `users.id` | Who last edited |
| `has_human_edits` | `boolean` | Default: `false` — flag to indicate human modifications exist |
| `needs_review` | `boolean` | Default: `false` — set to true when merge conflicts detected |
| `search_vector` | `tsvector` | Full-text search index (generated always from title + content_markdown) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `article_versions`

Full version history for every article change.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `version_number` | `integer` NOT NULL | Auto-incrementing per article |
| `content_markdown` | `text` NOT NULL | Full article content at this version |
| `content_json` | `jsonb` | BlockNote JSON at this version |
| `technical_view_markdown` | `text` | Technical view at this version |
| `change_source` | `enum('ai_generated','ai_updated','human_edited','ai_merged','draft')` | What triggered this version |
| `change_summary` | `text` | Brief description of what changed |
| `created_by` | `uuid` FK → `users.id` | NULL if AI-generated |
| `created_at` | `timestamptz` | |

### `article_file_links`

Maps articles to the source files they represent.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `github_file_id` | `uuid` FK → `github_files.id` | |
| `relevance_note` | `text` | AI-generated explanation of why this file relates to the article |
| `created_at` | `timestamptz` | |

### `article_db_tables`

Maps articles to database tables they describe.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `table_name` | `text` NOT NULL | Database table name |
| `columns_json` | `jsonb` | Key columns and their descriptions |
| `relevance_note` | `text` | AI-generated explanation of the relationship |
| `created_at` | `timestamptz` | |

### `categories`

Top-level navigation groupings.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `name` | `text` NOT NULL | |
| `slug` | `text` UNIQUE NOT NULL | |
| `icon` | `text` | Optional icon identifier |
| `sort_order` | `integer` | |
| `parent_category_id` | `uuid` FK → `categories.id` | Nested categories |
| `created_at` | `timestamptz` | |

### `user_bookmarks`

User article bookmarks.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` PK, FK → `users.id` | Composite PK with article_id |
| `article_id` | `uuid` PK, FK → `articles.id` | |
| `created_at` | `timestamptz` | |

### `ai_review_annotations`

Post-merge AI semantic review annotations.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `version_id` | `uuid` FK → `article_versions.id` | |
| `section_heading` | `text` NOT NULL | Heading the issue relates to |
| `concern` | `text` NOT NULL | Description of the semantic issue |
| `severity` | `enum('info','warning','error')` | |
| `is_dismissed` | `boolean` | Default: `false` |
| `dismissed_by` | `uuid` FK → `users.id` | |
| `dismissed_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |

### `comments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `user_id` | `uuid` FK → `users.id` | |
| `content_markdown` | `text` NOT NULL | Comment body (supports Markdown) |
| `parent_comment_id` | `uuid` FK → `comments.id` | For threaded replies (single-level) |
| `is_resolved` | `boolean` | Default: `false` |
| `resolved_by` | `uuid` FK → `users.id` | |
| `resolved_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `mentions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `comment_id` | `uuid` FK → `comments.id` | |
| `mentioned_user_id` | `uuid` FK → `users.id` | |
| `notified` | `boolean` | Default: `false` |
| `created_at` | `timestamptz` | |

### `ai_conversations`

Stores Ask AI conversation history per user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` | |
| `article_id` | `uuid` FK → `articles.id` NULLABLE | NULL for global conversations, set for page-level conversations |
| `title` | `text` | Auto-generated from first question or user-editable |
| `mode` | `enum('global','page')` | Whether this was a global or page-level Ask AI conversation |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `ai_conversation_messages`

Individual messages within an Ask AI conversation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` FK → `ai_conversations.id` | |
| `role` | `enum('user','assistant')` | |
| `content_markdown` | `text` NOT NULL | Message content |
| `context_used` | `jsonb` | Record of what context was sent with this message (article IDs, file paths, etc.) |
| `created_at` | `timestamptz` | |

### `article_images`

Tracks images associated with articles.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `filename` | `text` NOT NULL | Stored filename (e.g., `a1b2c3d4_1707840000.jpg`) |
| `original_filename` | `text` | Original filename from upload/paste |
| `file_path` | `text` NOT NULL | Relative path from storage root (e.g., `images/{article_id}/{filename}`) |
| `size_bytes` | `integer` | Compressed file size |
| `width` | `integer` | Compressed width in pixels |
| `height` | `integer` | Compressed height in pixels |
| `uploaded_by` | `uuid` FK → `users.id` | |
| `created_at` | `timestamptz` | |

### `sync_logs`

Audit trail for GitHub sync operations.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `started_at` | `timestamptz` | |
| `completed_at` | `timestamptz` | |
| `status` | `enum('running','completed','failed')` | |
| `trigger_type` | `enum('scheduled','manual')` | |
| `files_changed` | `integer` | |
| `articles_created` | `integer` | |
| `articles_updated` | `integer` | |
| `error_log` | `text` | |
| `ai_model_used` | `text` | Model string at time of sync |

### Indexes

```sql
-- Full-text search
CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);

-- Common lookups
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_parent ON articles(parent_article_id);
CREATE INDEX idx_article_versions_article ON article_versions(article_id, version_number DESC);
CREATE INDEX idx_comments_article ON comments(article_id, created_at DESC);
CREATE INDEX idx_github_files_path ON github_files(file_path);
CREATE INDEX idx_article_file_links_article ON article_file_links(article_id);
CREATE INDEX idx_article_file_links_file ON article_file_links(github_file_id);
CREATE INDEX idx_mentions_user ON mentions(mentioned_user_id, notified);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_conversations_article ON ai_conversations(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX idx_ai_conversation_messages_convo ON ai_conversation_messages(conversation_id, created_at ASC);
CREATE INDEX idx_article_images_article ON article_images(article_id);
```

---

## 18. API Routes Reference

### Articles

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/articles/[id]/save` | Save article content with optimistic locking |
| POST | `/api/articles/[id]/restore` | Restore a previous version |
| GET | `/api/articles/[id]/versions` | Get version history (optional `?source=` filter) |
| GET | `/api/articles/[id]/annotations` | Get active AI review annotations |
| POST | `/api/articles/[id]/annotations/[annotationId]/dismiss` | Dismiss an annotation |
| POST | `/api/articles/[id]/dismiss-review` | Clear the needs-review flag |
| GET/PUT/DELETE | `/api/articles/[id]/draft` | Manage server-side drafts |
| POST | `/api/articles/[id]/images` | Upload article images |
| GET/POST | `/api/articles/[id]/comments` | Get or post comments |
| POST | `/api/articles/[id]/comments/[commentId]/resolve` | Toggle comment resolved state |

### Chat & Conversations

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/chat` | Global Ask AI (streaming SSE) |
| POST | `/api/chat/article` | Page-level Ask AI (streaming SSE) |
| GET/POST | `/api/conversations` | List or create conversations |
| GET/DELETE | `/api/conversations/[id]` | Load or delete a conversation |

### Sync & Admin

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/sync` | Trigger manual sync |
| POST | `/api/admin/sync/cron` | Cron-triggered sync (bearer token auth) |
| GET | `/api/sync/stream` | SSE endpoint for live sync log streaming |
| POST | `/api/admin/settings/test-connection` | Test GitHub API connection |
| POST | `/api/admin/settings/test-notification` | Test Slack/SendGrid configuration |

### Other

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/github/file-content` | Fetch and syntax-highlight a file from GitHub |
| GET | `/api/images/[articleId]/[filename]` | Serve uploaded article images |
| GET | `/api/users/search` | Search users for @mention autocomplete |
| * | `/api/auth/[...nextauth]` | NextAuth.js authentication handler |

---

## Further Reading

- [AI Pipeline Deep Dive](ai-pipeline.md) — Detailed technical documentation of the multi-stage pipeline, directory compression, plan expansion, and scaling characteristics.
