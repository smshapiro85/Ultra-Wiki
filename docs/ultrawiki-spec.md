# CodeWiki — Product Specification & Project Plan

> **Version:** 0.2.2-draft
> **Last Updated:** 2026-02-13
> **Purpose:** Complete spec for building an AI-augmented internal wiki for a monolith software application, designed to be imported into a Claude Code session as a project plan.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Database Schema](#3-database-schema)
4. [Authentication & User Management](#4-authentication--user-management)
5. [GitHub Integration & File Sync](#5-github-integration--file-sync)
6. [AI Processing Pipeline](#6-ai-processing-pipeline)
7. [AI + Human Content Coexistence](#7-ai--human-content-coexistence)
8. [Wiki Viewer & Editor](#8-wiki-viewer--editor)
9. [Image Handling](#9-image-handling)
10. [Technical View (File & DB Relationship Panel)](#10-technical-view-file--db-relationship-panel)
11. [Comments & Mentions](#11-comments--mentions)
12. [Ask AI Feature](#12-ask-ai-feature)
13. [Notifications (Slack & Email)](#13-notifications-slack--email)
14. [Admin Settings](#14-admin-settings)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Project Overview

### Problem

Internal teams working on a large monolith application lack a living, accurate source of truth for how modules, features, and components work. Documentation goes stale, and manual upkeep is unsustainable.

### Solution

**CodeWiki** is a self-hosted, AI-augmented internal wiki that:

- **Automatically generates and updates** wiki articles by analyzing the monolith's source code from GitHub
- **Allows human editing, commenting, and annotation** on top of AI-generated content
- **Preserves user contributions** when AI updates articles based on code changes
- **Provides a technical view** linking articles to their underlying source files and database tables
- **Offers an "Ask AI" feature** at both the global app level and per-article level for on-the-spot questions

### Key Principles

- **Open-source first:** Use highly-adopted, well-starred open-source libraries and tools wherever possible
- **Single-tenant:** Built for one company on a private server; not a commercial product
- **Markdown-native:** All content stored as raw Markdown in the database — no proprietary formats
- **AI + Human coexistence:** User edits are first-class citizens and are never silently overwritten

### Target Users

- Developers
- QA Engineers
- Product Managers

---

## 2. Architecture & Tech Stack

### Application Framework

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | **Next.js 14+ (App Router)** | Full-stack React framework, SSR, API routes, widely adopted |
| **UI Components** | **shadcn/ui + Tailwind CSS** | High-quality, customizable components |
| **Markdown Rendering** | **react-markdown + remark/rehype plugins** | Mature Markdown rendering pipeline with plugin support |
| **Markdown Editing** | **BlockNote** | Modern WYSIWYG block-based editor, great UI, active development, high GitHub stars. Must be configured to export/import raw Markdown (BlockNote supports Markdown serialization). If BlockNote's Markdown output proves insufficient for our needs, fallback to **Milkdown** (ProseMirror-based, more mature Markdown-native editor). |
| **Database** | **Neon Postgres** (remote) | Serverless Postgres; connection string configured in admin settings |
| **ORM** | **Drizzle ORM** | Type-safe, lightweight, great Postgres support |
| **Auth** | **NextAuth.js (Auth.js) v5** | Google OIDC provider, session management, widely adopted |
| **AI Gateway** | **OpenRouter API** | Model-agnostic; API key + model name configurable in admin |
| **GitHub API** | **Octokit (@octokit/rest)** | Official GitHub SDK |
| **Job Scheduling** | **pgboss** | Postgres-backed job queue — no additional infrastructure required (uses the same Neon Postgres database). Provides cron scheduling, automatic retries with exponential backoff, concurrency control, and job status tracking. Ideal for single-tenant deployments. |
| **Image Processing** | **sharp** | High-performance image resizing and compression for pasted/uploaded images |
| **Notifications** | **Slack Web API (@slack/web-api)** + **SendGrid (@sendgrid/mail)** | User-configurable notification channels |
| **Diff** | **diff** (npm) | For computing and displaying content diffs in version history |
| **Search** | **Postgres full-text search (tsvector)** | Built-in, no extra infrastructure needed |

### Deployment

- Self-hosted on a private server (Docker recommended)
- Docker Compose file with: Next.js app (single container — pgboss uses the same Neon Postgres, no additional services needed)
- Neon Postgres is remote; connection string provided via `DATABASE_URL` environment variable (not stored in site_settings — the app needs this to start up)
- Local volume mount for image storage

---

## 3. Database Schema

All content is stored as **raw Markdown**. Below is the complete schema.

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

A key-value configuration table for admin-level settings.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` PK | |
| `key` | `text` UNIQUE NOT NULL | Setting key name |
| `value` | `text` | Stored as plain text (DB connection is TLS-encrypted via Neon). Secrets are masked in the admin UI — full values are never sent to the frontend. |
| `description` | `text` | Human-readable description |
| `updated_at` | `timestamptz` | |

**Required settings keys:**

- `github_repo_url` — Full GitHub repo URL
- `github_api_key` — Personal access token or GitHub App token
- `openrouter_api_key` — OpenRouter API key
- `openrouter_model` — Model string (e.g., `anthropic/claude-sonnet-4-20250514`)
- `sync_cron_schedule` — Cron expression (default: `0 9 * * 6` = Saturdays 9 AM)
- `sendgrid_api_key` — SendGrid API key for email notifications
- `sendgrid_from_email` — Sender email address
- `slack_bot_token` — Slack Bot OAuth token
- `analysis_prompt` — The prompt used for analyzing code changes and generating/updating articles
- `article_style_prompt` — The prompt that governs article writing tone and structure
- `ask_ai_global_prompt` — The system prompt for the global (app-wide) Ask AI feature
- `ask_ai_page_prompt` — The system prompt for the per-article Ask AI feature

### `github_files`

Tracks all files imported from the GitHub repo.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `file_path` | `text` UNIQUE NOT NULL | Relative path from repo root |
| `sha` | `text` | Latest Git SHA for this file |
| `content` | `text` | File content (latest synced version) |
| `excluded` | `boolean` | Default: `false` — if true, file is excluded from analysis |
| `last_synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |

### `excluded_paths`

Glob/folder-level exclusion rules.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `pattern` | `text` UNIQUE NOT NULL | Glob pattern or folder path (e.g., `node_modules/`, `*.test.ts`) |
| `created_at` | `timestamptz` | |

### `articles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `title` | `text` NOT NULL | Article title |
| `slug` | `text` UNIQUE NOT NULL | URL-friendly identifier |
| `content_markdown` | `text` NOT NULL | Current article body (raw Markdown) |
| `technical_view_markdown` | `text` | Technical view content (raw Markdown) — related files, DB tables, and explanations |
| `category_id` | `uuid` FK → `categories.id` | |
| `parent_article_id` | `uuid` FK → `articles.id` | For nested article hierarchy |
| `sort_order` | `integer` | For ordering within a category/parent |
| `last_ai_generated_at` | `timestamptz` | When AI last generated/updated this article |
| `last_human_edited_at` | `timestamptz` | When a human last edited this article |
| `last_human_editor_id` | `uuid` FK → `users.id` | Who last edited |
| `has_human_edits` | `boolean` | Default: `false` — flag to indicate human modifications exist |
| `search_vector` | `tsvector` | Full-text search index |
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
| `technical_view_markdown` | `text` | Technical view at this version |
| `change_source` | `enum('ai_generated','ai_updated','human_edited','ai_merged')` | What triggered this version |
| `change_summary` | `text` | Brief description of what changed |
| `author_id` | `uuid` FK → `users.id` | NULL if AI-generated |
| `diff_from_previous` | `text` | Stored diff (unified format) for quick display |
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

### `comments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `article_id` | `uuid` FK → `articles.id` | |
| `user_id` | `uuid` FK → `users.id` | |
| `content_markdown` | `text` NOT NULL | Comment body (supports Markdown) |
| `parent_comment_id` | `uuid` FK → `comments.id` | For threaded replies |
| `resolved` | `boolean` | Default: `false` |
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

## 4. Authentication & User Management

### Google OIDC Login

- **Sole authentication method:** Google OIDC via NextAuth.js v5
- On first login, a `users` record is created with `role = 'user'`
- The very first user to log in (or a seed process) is set to `role = 'admin'`
- Admins can promote/demote users in the admin panel

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | All user capabilities + admin settings, user management, manual sync trigger, prompt editing, file exclusion management |
| **User** | View wiki, edit articles, comment, Ask AI, configure personal notification preferences |

### User Profile

- Display name (editable)
- Avatar (from Google, or uploaded)
- Email (from Google, read-only)
- Notification preferences (see §13)

---

## 5. GitHub Integration & File Sync

### Configuration (Admin Settings)

- **GitHub Repo URL** — e.g., `https://github.com/org/monolith`
- **GitHub API Key** — Personal access token (PAT) with repo read access, or GitHub App installation token
- **Sync Schedule** — Cron expression (default: `0 9 * * 6` — every Saturday at 9 AM), displayed with a human-readable preview (e.g., "Every Saturday at 9:00 AM")
- **Manual Sync** — Button in admin panel to trigger sync immediately

### Sync Process

```
1. FETCH: Pull latest file tree from GitHub API (using Octokit)
2. FILTER: Apply exclusion rules (excluded_paths + per-file github_files.excluded)
3. DIFF: Compare file SHAs to detect changed/added/removed files
4. STORE: Update github_files table with new content and SHAs
5. ANALYZE: Send changed files to AI processing pipeline (§6)
6. LOG: Record sync operation in sync_logs table
```

### File Tree Management (Admin UI)

- Visual file tree browser showing all repo files/folders
- Checkbox to exclude/include folders and files
- Excluded paths stored in `excluded_paths` table (supports glob patterns)
- Per-file exclusions stored on `github_files.excluded`
- **New files/folders are INCLUDED by default** on first import
- **Previously excluded paths remain excluded** even when new syncs occur — exclusions are never overwritten
- Bulk exclude/include operations supported

### Initial Import

- Full clone/download of repo file tree on first setup
- All files stored in `github_files` table
- Admin reviews file tree and excludes irrelevant paths before triggering first AI analysis
- First AI analysis generates the initial set of articles

### Job Queue (pgboss)

The sync process runs as a pgboss job with:

- **Automatic retries** — If a sync fails (e.g., GitHub API timeout, AI API error), pgboss retries up to 3 times with exponential backoff
- **Job visibility** — Admin can see the status of current and past sync jobs (pending, active, completed, failed) — all stored in Postgres
- **Concurrency lock** — Only one sync job can run at a time; manual triggers while a sync is running are queued
- **Progress tracking** — Job reports progress (files fetched, files analyzed, articles updated) visible in admin UI
- **Cron scheduling** — pgboss natively supports cron expressions for repeatable jobs

---

## 6. AI Processing Pipeline

### Model Configuration (Admin Settings)

- **OpenRouter API Key**
- **Model Name** — Free-text field (e.g., `anthropic/claude-sonnet-4-20250514`)
- These are used for all AI operations: article generation, article updates, and Ask AI

### Prompts (Admin Editable)

Four primary prompts stored in `site_settings`, editable via the admin UI:

#### 1. Analysis Prompt (Code → Article Mapping)

Responsible for:
- Analyzing changed files
- Determining which articles need to be created or updated
- Identifying module/feature/component groupings
- Mapping files to articles and database tables to articles

Default prompt template (admin-editable):

```
You are updating internal wiki documentation for a software platform
based on recent code changes.

## Changed Files
{{changes_summary}}

## Existing Articles
{{existing_articles_index}}

## Your Task

1. Analyze the changed files to understand what was added or modified
2. Determine which existing articles need updates, or if new articles
   should be created
3. For each affected article, provide:
   - The article slug (existing or new)
   - Updated content in Markdown
   - Updated technical view listing related files and DB tables
   - A brief change summary

### Guidelines
- Focus on business-relevant changes (new features, settings,
  workflows, permissions)
- Ignore trivial changes (refactoring, bug fixes that don't change
  behavior, formatting)
- Organize articles by functional area / module
- Include related file paths and database tables for each article
- Maintain existing article structure where possible

### CRITICAL: Handling Human-Edited Articles
For articles flagged as human-edited, you MUST:
- Preserve all user-authored content sections
- Only update sections that are directly contradicted by code changes
- Add new information as NEW sections rather than modifying existing text
- Flag any conflicts between user edits and code changes in your
  change summary
- Never delete user-added content unless the underlying feature has
  been completely removed

Respond in JSON format:
{
  "articles": [
    {
      "slug": "string",
      "title": "string",
      "action": "create | update",
      "content_markdown": "string",
      "technical_view_markdown": "string",
      "change_summary": "string",
      "related_files": ["path/to/file.ts"],
      "related_db_tables": [
        { "table_name": "string", "columns": {}, "relevance": "string" }
      ],
      "category_suggestion": "string",
      "conflicts_with_human_edits": ["description of conflict"]
    }
  ],
  "summary": "Overall summary of changes"
}
```

#### 2. Article Style Prompt (Writing Guidelines)

Governs tone, structure, and formatting of generated articles. Based on a proven approach for translating code analysis into clear, business-focused internal documentation:

```
You are writing internal wiki articles for a software platform by
analyzing source code and translating it into clear business
documentation.

## Goal
Create streamlined internal wiki articles that explain how the product
works (business rules, logic flows, permissions) for an internal team
audience.

## Audience
Internal team: Developers, QA Engineers, Product Managers.

## Process
When analyzing code to create or update an article:

1. Discovery: Identify the feature/module, key terms, and prioritized
   file list from the code
2. Deep Dive: Trace the logic for conditions, defaults, permissions,
   and settings
3. Translation: Convert all technical findings into business concepts
   before writing

### Translation Examples
- Code: if (user.Role == Roles.Admin) → Business: "If the user is
  an Administrator..."
- Code: IsSettingEnabled(Setting.BlockStudent) → Business: "If the
  'Block Student' site setting is enabled..."
- Code: ng-if="!showStatus" → Business: "The status is hidden from
  view..."
- Code: return null; → Business: "The action is blocked / Nothing
  happens."

## Output Rules

### Forbidden in article body
- No code blocks or snippets
- No file paths (e.g., TT.Jobs/Services/...)
- No variable names (e.g., IsAdminApproved, ng-if)
- No class/method names (e.g., JobService.cs, ToggleApproval)
- No line numbers
- No API endpoints or DB table names in the main article body
  (these belong in the Technical View)

### Required in articles
- Plain English explanation of rules
- "If / Then" logic flows for business rules
- User Roles explicitly mentioned (Admin, Student, Employer, etc.)
- Site Settings names (human readable)
- Defaults (What happens if nothing is configured?)

## Article Structure

# [Feature Name] Business Rules

Module: [Product Area]
Last Updated: [Date]

## Overview
[1-2 sentences explaining what this feature does for the user.]

## Core Business Rules

### [Rule Category Name]
- [Explanation of behavior]
- Logic: If [Condition] occurs -> then [Outcome]

### [Rule Category Name]
- [Explanation of behavior]
- Logic: If [Condition] occurs -> then [Outcome]

## User Permissions

### Administrator
- [List specific rights or constraints]

### Student
- [List specific rights or constraints]

### [Other Roles]
- [List specific rights or constraints]

## Configuration & Settings

### Default Behavior
- [What happens out of the box?]

### [Setting Name]
- If enabled, [how behavior changes]

## Exceptions & Edge Cases
- [Describe any special logic, overrides, or "unless" scenarios]

## Related Articles
- [Links to related wiki articles]
```

#### 3. Global Ask AI Prompt

For the app-wide Ask AI feature where users ask questions without being on a specific page:

```
You are an AI assistant for an internal wiki documenting a software
platform. A team member is asking a general question about the platform.

## Available Articles Index
{{articles_index}}

## User's Question
{{user_question}}

Your job:
1. Answer the question using your knowledge of the platform
2. If the answer relates to a specific article, reference it by name
   so the user can navigate to it
3. If you need more context to answer well, say so and suggest which
   article(s) the user should look at
4. If the question is about something not yet documented, say so
   clearly

Keep answers concise and practical. Direct users to specific articles
for deeper reading.
```

#### 4. Page-Level Ask AI Prompt

For the per-article Ask AI feature where context is scoped to the current article:

```
You are an AI assistant helping a team member understand the
{{article_title}} feature/module.

## Article Content
{{article_markdown}}

## Technical Context
{{technical_view_markdown}}

## Source Files
{{source_files_content}}

## Database Schema
{{db_tables_info}}

## User's Question
{{user_question}}

Answer based primarily on the provided context. If the question
requires knowledge beyond what's provided, note that and provide
your best answer while indicating what additional context would help.
Be concise and focus on practical understanding.
```

---

## 7. AI + Human Content Coexistence

This is the most critical and delicate aspect of CodeWiki. The system must ensure that user contributions are respected while keeping AI-generated content up to date with code changes.

### Content Lifecycle States

Each article tracks its edit state:

| State | `has_human_edits` | `last_human_edited_at` | Behavior on AI Update |
|-------|:-:|:-:|---|
| **AI-only** | `false` | `NULL` | AI freely overwrites content |
| **Human-edited** | `true` | `<timestamp>` | AI uses merge strategy (see below) |

### AI Update Strategy for Human-Edited Articles

When a code sync triggers an article update and the article has `has_human_edits = true`:

```
1. FETCH current article content (which includes human edits)
2. FETCH the last AI-generated version from article_versions
   (most recent where change_source = 'ai_generated' or 'ai_updated')
3. COMPUTE diff between last AI version and current content
   → This diff represents the human edits
4. GENERATE new AI content based on code changes
5. SEND to AI with a merge prompt:
   - "Here is the previous AI-generated content"
   - "Here are the human edits (diff)"
   - "Here is what the code changes require"
   - "Merge these, PRESERVING human edits, and only updating
      sections where code changes directly contradict them"
6. STORE result as a new version with change_source = 'ai_merged'
7. IF conflicts detected, flag the article for human review
```

### Conflict Resolution

When the AI detects a conflict (human edit says X, code now does Y):

- The article is flagged with a **review banner** visible to all users
- The banner shows: "This article was updated by AI on [date] and may conflict with previous human edits. [View diff] [Dismiss]"
- The version history diff view makes it easy to see exactly what changed
- Any user can dismiss the banner after reviewing

### Version Tracking

Every change to an article creates a new `article_versions` record:

- `change_source` clearly identifies: `ai_generated`, `ai_updated`, `human_edited`, `ai_merged`
- Full content stored per version (not just diffs) for easy rollback
- Unified diff (`diff_from_previous`) stored for quick display
- Users can view any version and restore (roll back) to any previous version

### Diff Viewer

- Side-by-side or inline diff view between any two versions
- Color-coded: green for additions, red for deletions
- Filter by change source (show only AI changes, only human changes, etc.)
- Accessible from the article page via a "History" button

---

## 8. Wiki Viewer & Editor

### Navigation

- **Left sidebar:** Collapsible category tree with nested articles
- **Breadcrumbs:** Show article hierarchy path
- **Search:** Global search bar with full-text search (Postgres `tsvector`)
  - Results ranked by relevance
  - Highlights matching text in results

### Article View

- Rendered Markdown content with syntax highlighting for code blocks
- **Tabs** at the top of each article:
  - **📄 Article** — Main wiki content
  - **🔧 Technical View** — Related files, DB tables, and relationship explanations (§10)
  - **💬 Comments** — Discussion thread (§11)
  - **📜 History** — Version history with diff viewer (§7)
- **Metadata sidebar:** Last updated, last editor, AI-generated vs human-edited badge, category
- **Ask AI button** — Opens the page-level Ask AI panel scoped to this article (§12)

### Article Editing

- **BlockNote** WYSIWYG Markdown editor (fallback: Milkdown if BlockNote Markdown output is insufficient)
- Outputs raw Markdown (no proprietary format)
- Toolbar: headings, bold, italic, code, links, images, tables, lists
- **Image paste/upload support** — see §9
- **Auto-save** draft (stored locally) with explicit "Save" action
- On save:
  - New `article_versions` record created with `change_source = 'human_edited'`
  - `has_human_edits` set to `true`
  - `last_human_edited_at` and `last_human_editor_id` updated
  - Change summary prompted (optional short description of what was changed)

---

## 9. Image Handling

### Overview

Users can paste or upload images when editing articles. Images are stored on the application's local filesystem (no external storage service required) and served via a Next.js API route.

### Image Processing Pipeline

When an image is pasted or uploaded:

```
1. RECEIVE image (from clipboard paste or file upload)
2. PROCESS with sharp:
   a. Resize: Constrain to max 1200x1200 pixels (maintain aspect ratio,
      only downscale — never upscale)
   b. Convert: Output as JPEG with quality 80 (good balance of quality
      and file size)
   c. Strip metadata: Remove EXIF data for privacy and size reduction
3. STORE compressed image to local filesystem
4. RECORD in article_images table
5. INSERT Markdown image reference into editor:
   ![image](/api/images/{article_id}/{filename})
```

### File Storage Structure

```
/data/images/
  ├── {article_id}/
  │   ├── {short_uuid}_{timestamp}.jpg
  │   ├── {short_uuid}_{timestamp}.jpg
  │   └── ...
  └── {article_id}/
      └── ...
```

- **Directory per article** — makes it clear which images belong to which article
- **Filename format:** `{8-char-uuid}_{unix-timestamp}.jpg` — unique and traceable
- **Only compressed images are stored** — originals are discarded after processing
- Volume mount in Docker: `/data/images` mapped to host storage

### Image Serving

- Images served via a Next.js API route: `GET /api/images/[articleId]/[filename]`
- Route verifies the file exists and serves it with appropriate cache headers
- No authentication required for image serving (images are internal-only by virtue of the app being on a private server)

### Image Cleanup

- When an article is deleted, its image directory can be cleaned up
- Orphaned images (referenced in old versions but not current content) are retained to support version history viewing

---

## 10. Technical View (File & DB Relationship Panel)

Each article has a companion **Technical View** that provides:

### Content (stored as `technical_view_markdown` on the article)

- **Related Source Files:** List of file paths with brief explanations of what each file does in the context of this article
- **Related Database Tables:** Table names, key columns, and how they relate to the feature
- **Architecture Notes:** Any relevant service relationships, API endpoints, or dependencies

### Data Model

- `article_file_links` — Many-to-many between articles and `github_files`, with `relevance_note`
- `article_db_tables` — Maps articles to DB table names with column info and relevance notes
- These are populated during the AI analysis step and updated on each sync

### UI

- Displayed as a tab on the article page
- Files are clickable links (deep link to GitHub repo file if public, or show file content in a modal)
- DB tables displayed in a structured table format with column details
- This view is also AI-editable during sync and human-editable

---

## 11. Comments & Mentions

### Article Comments

- Threaded comment system on each article's "Comments" tab
- Supports Markdown in comment body
- Shows user avatar, name, and timestamp
- Reply threading (one level deep, or nested)
- Comments can be resolved/unresolved by any user

### @Mentions

- Type `@` in a comment to get an autocomplete dropdown of users
- Creates a record in `mentions` table
- Triggers notification based on the mentioned user's preferences

### Inline Annotations — DEFERRED

Inline text highlighting with attached comments is **deferred to a future version** unless BlockNote provides well-supported, native annotation/commenting functionality. If it does, it can be included; otherwise, this feature adds significant complexity for v1.

---

## 12. Ask AI Feature

### Overview

Ask AI has **two modes**, each with its own prompt and context strategy:

| Mode | Where | Context Scope | Prompt Setting Key |
|------|-------|---------------|-------------------|
| **Global** | Available from any page via a persistent button/icon in the app header | All articles index + broad platform knowledge | `ask_ai_global_prompt` |
| **Page-Level** | Button on each article page | Current article + technical view + source files + DB tables | `ask_ai_page_prompt` |

### Global Ask AI

- Accessible from anywhere in the app via a button in the header/nav
- Opens a slide-out chat panel
- Context: The AI receives an index of all articles (titles, slugs, brief descriptions) so it can reference and direct users to specific articles
- Can answer broad questions like "How does the job posting approval flow work?" and point users to the relevant article
- Conversations are **persisted** per user in `ai_conversations` (with `mode = 'global'`, `article_id = NULL`)

### Page-Level Ask AI

- Button on each article page (e.g., "Ask about this feature")
- Opens a chat panel scoped to the current article
- Context assembly:
  ```
  1. GATHER primary context:
     - Current article content (Markdown)
     - Technical view content (Markdown)
     - Source file contents (from article_file_links → github_files)
     - DB table schemas (from article_db_tables)

  2. GATHER secondary context (if needed):
     - Related articles (via category or cross-links)
     - The AI model may determine it needs broader context and can
       request additional files or articles

  3. SEND to AI with the page-level prompt
  ```
- Conversations are **persisted** per user per article in `ai_conversations` (with `mode = 'page'`, `article_id` set)

### Conversation Persistence

- Users can see their Ask AI conversation history in their profile or via the Ask AI panel
- Conversations are listed with: title (auto-generated from first question), date, and associated article (if page-level)
- Users can continue a previous conversation or start a new one
- Conversations can be deleted by the user

### UI

- **Global:** Persistent icon in the app header → opens slide-out chat panel
- **Page-Level:** "Ask about this feature" button on article view → opens contextual chat panel
- Both panels show:
  - Chat-style message history
  - Input field for new questions
  - Streaming response rendering (Markdown)
  - Context indicator showing what context was used (article titles, file names)
  - "New conversation" button
  - Conversation history list

---

## 13. Notifications (Slack & Email)

### User-Level Configuration

Each user configures their own preferences in their profile:

| Setting | Description |
|---------|------------|
| **Slack notifications** | Enable/disable; requires Slack user ID input |
| **Email notifications** | Enable/disable (requires admin to configure SendGrid) |
| **Notify on @mention** | Get notified when mentioned in a comment |
| **Notify on article activity** | Get notified when articles you've interacted with (edited or commented on) are updated |

### Slack Integration

- A **Slack App** is created by the company (bot token stored in admin settings)
- Users enter their Slack user ID in their profile settings
- Notifications sent as DMs via the Slack Bot
- Notification content: "You were mentioned in a comment on [Article Title]" with a link

### Email Integration (SendGrid)

- **SendGrid API Key** and **From Email** configured at the admin level
- When enabled and a user has email notifications on, sends transactional emails for:
  - @mentions
  - Article activity (updates to articles they've engaged with)
- Simple, clean email template with a link back to the article

### Notification Events

| Event | Recipients |
|-------|-----------|
| @mention in comment | Mentioned user |
| New comment on article | Users who have commented on or edited the article |
| AI sync updated an article | Users who have edited that article |
| AI sync flagged a conflict | Users who have edited that article |

---

## 14. Admin Settings

### Admin Dashboard Sections

#### General Settings
- Application name / branding
- Database connection status indicator

#### GitHub Integration
- Repo URL
- API key (masked input)
- File tree browser with exclude/include checkboxes
- Sync schedule (cron expression) with human-readable preview
- Manual sync button with status/progress indicator
- Sync job queue dashboard (pgboss job status: pending, active, completed, failed — queried from Postgres)
- Sync history log (from `sync_logs` table)

#### AI Configuration
- OpenRouter API key (masked input)
- Model name (text input)
- Test connection button
- **Analysis Prompt** — Full-text editor for the code analysis prompt
- **Article Style Prompt** — Full-text editor for the article writing guidelines
- **Global Ask AI Prompt** — Full-text editor for the app-wide Q&A prompt
- **Page-Level Ask AI Prompt** — Full-text editor for the per-article Q&A prompt

#### User Management
- User list with role management (admin/user)
- Ability to promote/demote users
- User activity overview

#### Notifications
- SendGrid API key and from email (admin-level)
- Slack Bot token (admin-level)
- Test buttons for both channels

---

## 15. Implementation Checklist

This checklist is ordered for incremental, buildable development. Each phase produces working functionality.

### Phase 1: Foundation

- [ ] **Project scaffolding**
  - [ ] Initialize Next.js 14+ project with App Router
  - [ ] Set up Tailwind CSS and shadcn/ui
  - [ ] Set up project structure (app/, components/, lib/, etc.)
  - [ ] Configure TypeScript
  - [ ] Create Dockerfile and docker-compose.yml
  - [ ] Set up local image storage volume mount (`/data/images`)

- [ ] **Database setup**
  - [ ] Install and configure Drizzle ORM
  - [ ] Create database schema (all tables from §3)
  - [ ] Create migration system
  - [ ] Create seed script for initial site_settings keys
  - [ ] Implement database connection using `DATABASE_URL` environment variable

- [ ] **Authentication**
  - [ ] Install and configure NextAuth.js v5
  - [ ] Set up Google OIDC provider
  - [ ] Implement user creation on first login
  - [ ] Implement role-based access control (admin/user middleware)
  - [ ] Create login page
  - [ ] First-user-is-admin logic (or admin seed)

### Phase 2: Admin Settings & GitHub Integration

- [ ] **Admin settings UI**
  - [ ] Create admin layout with sidebar navigation
  - [ ] Build key-value settings editor (with masked fields for secrets)
  - [ ] Implement settings CRUD API routes

- [ ] **GitHub integration**
  - [ ] Implement GitHub API connection using Octokit
  - [ ] Build file tree fetcher (recursive repo contents)
  - [ ] Create file tree browser UI with exclude/include checkboxes
  - [ ] Implement exclusion rules (excluded_paths + per-file)
  - [ ] Build initial import process (full file download + storage)
  - [ ] Implement incremental sync (SHA-based diffing)
  - [ ] Create sync_logs recording
  - [ ] Build manual sync trigger (API route + admin UI button)
  - [ ] Set up pgboss (connects to same Neon Postgres — no additional infrastructure)
  - [ ] Implement scheduled sync job (cron expression from settings → pgboss cron job)
  - [ ] Concurrency lock (one sync at a time)
  - [ ] Sync status/progress indicator in admin UI
  - [ ] Job dashboard in admin UI (pgboss job status, retry controls — queries Postgres directly)

### Phase 3: AI Processing Pipeline

- [ ] **AI service layer**
  - [ ] Create OpenRouter API client (configurable key + model)
  - [ ] Implement prompt template system (reads from site_settings, supports `{{variable}}` interpolation)
  - [ ] Add test connection endpoint

- [ ] **Article generation**
  - [ ] Build change analysis pipeline (diff detection → AI prompt assembly)
  - [ ] Implement article creation from AI response (parse JSON, store Markdown)
  - [ ] Implement article update from AI response
  - [ ] Populate article_file_links and article_db_tables from AI output
  - [ ] Populate categories from AI suggestions
  - [ ] Generate technical_view_markdown during article creation

- [ ] **AI + Human merge logic**
  - [ ] Implement merge strategy for human-edited articles (§7)
  - [ ] Diff computation between AI versions and current content
  - [ ] Conflict detection and flagging
  - [ ] Review banner UI component

- [ ] **Admin prompt editors**
  - [ ] Analysis prompt editor (full-text, with template variable reference)
  - [ ] Article style prompt editor
  - [ ] Global Ask AI prompt editor
  - [ ] Page-level Ask AI prompt editor

### Phase 4: Wiki Viewer

- [ ] **Layout and navigation**
  - [ ] Build left sidebar with collapsible category/article tree
  - [ ] Implement breadcrumb navigation
  - [ ] Create responsive layout (sidebar collapses on mobile)

- [ ] **Article view page**
  - [ ] Markdown renderer (react-markdown + remark-gfm + rehype plugins)
  - [ ] Syntax highlighting for code blocks (rehype-highlight or similar)
  - [ ] Tab system: Article | Technical View | Comments | History
  - [ ] Article metadata sidebar (last updated, editor, AI/human badge)

- [ ] **Search**
  - [ ] Implement Postgres full-text search (tsvector trigger on article content)
  - [ ] Build search API route
  - [ ] Create search UI with results page and text highlighting
  - [ ] Implement search-as-you-type with debouncing

### Phase 5: Article Editing & Image Handling

- [ ] **Markdown editor**
  - [ ] Install and configure BlockNote
  - [ ] Configure BlockNote to export/import raw Markdown
  - [ ] If BlockNote Markdown output is insufficient, switch to Milkdown
  - [ ] Toolbar configuration (headings, bold, italic, code, links, tables, lists)
  - [ ] Auto-save drafts (localStorage)

- [ ] **Image paste/upload**
  - [ ] Install and configure sharp for image processing
  - [ ] Build image upload API route (`POST /api/images/[articleId]`)
  - [ ] Implement image processing: resize (max 1200x1200), JPEG quality 80, strip EXIF
  - [ ] Store processed images to `/data/images/{articleId}/{filename}`
  - [ ] Record in article_images table
  - [ ] Build image serving API route (`GET /api/images/[articleId]/[filename]`)
  - [ ] Integrate image paste handler into BlockNote editor
  - [ ] Integrate image file upload into BlockNote editor
  - [ ] Insert Markdown image reference on upload/paste

- [ ] **Save workflow**
  - [ ] Save button → create article_versions record
  - [ ] Change summary prompt (optional modal)
  - [ ] Update article flags (has_human_edits, timestamps, editor)
  - [ ] Optimistic locking (check version hasn't changed since edit started)

- [ ] **Version history**
  - [ ] Version list UI on History tab
  - [ ] Diff viewer (side-by-side and inline modes)
  - [ ] Version restore (rollback) functionality
  - [ ] Filter by change_source

### Phase 6: Technical View

- [ ] **Technical view tab**
  - [ ] Render technical_view_markdown
  - [ ] Display related files from article_file_links with GitHub deep links
  - [ ] Display related DB tables from article_db_tables in structured format
  - [ ] Make technical view editable (same Markdown editor as articles)

### Phase 7: Comments & Mentions

- [ ] **Comment system**
  - [ ] Comment CRUD API routes
  - [ ] Threaded comment UI on Comments tab
  - [ ] Markdown rendering in comments
  - [ ] User avatar + name + timestamp display
  - [ ] Resolve/unresolve functionality

- [ ] **@Mentions**
  - [ ] User autocomplete on `@` trigger
  - [ ] Mention detection and storage in mentions table
  - [ ] Mention rendering (styled/linked @username)

### Phase 8: Ask AI

- [ ] **Global Ask AI**
  - [ ] Persistent Ask AI button/icon in app header
  - [ ] Slide-out chat panel component
  - [ ] Articles index context assembly (titles, slugs, descriptions)
  - [ ] OpenRouter API call with global prompt + context
  - [ ] Streaming response rendering (Markdown)

- [ ] **Page-Level Ask AI**
  - [ ] "Ask about this feature" button on article view
  - [ ] Contextual chat panel component
  - [ ] Context assembly (article + technical view + source files + DB tables)
  - [ ] OpenRouter API call with page-level prompt + context
  - [ ] Streaming response rendering (Markdown)
  - [ ] Context indicator showing what context was used

- [ ] **Conversation persistence**
  - [ ] Save conversations to ai_conversations + ai_conversation_messages tables
  - [ ] Conversation history list in Ask AI panel
  - [ ] Continue previous conversation
  - [ ] Start new conversation
  - [ ] Delete conversation
  - [ ] Auto-generate conversation title from first question

### Phase 9: Notifications

- [ ] **Slack notifications**
  - [ ] Slack Bot integration (admin token configuration)
  - [ ] User Slack ID input in profile settings
  - [ ] DM notification sender
  - [ ] Notification templates

- [ ] **Email notifications (SendGrid)**
  - [ ] SendGrid configuration (admin-level API key + from email)
  - [ ] Email notification sender
  - [ ] Email templates (HTML)
  - [ ] User opt-in/out in profile settings

- [ ] **Notification triggers**
  - [ ] @mention → notify mentioned user
  - [ ] New comment → notify article participants
  - [ ] AI sync update → notify article editors
  - [ ] AI conflict flag → notify article editors

### Phase 10: Polish & Production Readiness

- [ ] **User profile page**
  - [ ] Edit display name
  - [ ] Upload/change avatar
  - [ ] Notification preferences UI
  - [ ] Ask AI conversation history view
  - [ ] Activity feed (recent edits and comments)

- [ ] **User management (admin)**
  - [ ] User list with search/filter
  - [ ] Role management (promote/demote)
  - [ ] User activity overview

- [ ] **Error handling & logging**
  - [ ] Global error boundaries
  - [ ] API error handling
  - [ ] Sync error recovery (pgboss retry + dead letter queue)
  - [ ] Application logging

- [ ] **Performance**
  - [ ] Database query optimization
  - [ ] Pagination for article lists, comments, version history
  - [ ] Lazy loading for file tree browser
  - [ ] Caching strategy for rendered Markdown
  - [ ] Image cache headers (long-lived, content-addressed filenames)

- [ ] **Documentation**
  - [ ] README with setup instructions
  - [ ] Environment variables documentation
  - [ ] Docker deployment guide (including image volume mount)
  - [ ] Admin onboarding guide

---

## Open Questions & Decisions to Make

1. **BlockNote Markdown fidelity:** BlockNote uses a block-based internal model and serializes to/from Markdown. Need to verify early in Phase 5 that its Markdown output faithfully round-trips (especially for tables, code blocks, and nested lists). If it doesn't, switch to Milkdown which is natively Markdown-first.

2. **AI context window limits:** For large codebases, the changed files + existing articles may exceed model context limits. May need a chunking/batching strategy for the analysis prompt — process changed files in groups and merge results.

3. **Ask AI conversation limits:** Should there be a cap on how many conversations a user can store, or how long conversations can be? For v1, probably not — but worth monitoring storage growth.

4. **Image migration on article move/merge:** If articles are ever reorganized (re-categorized, merged, split), the image directory structure (keyed by article_id) remains stable since it uses article_id not slug. No migration needed unless articles are deleted and recreated.
