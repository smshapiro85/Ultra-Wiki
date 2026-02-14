# CodeWiki

## What This Is

CodeWiki is a self-hosted, AI-augmented internal wiki that automatically generates and updates documentation by analyzing a monolith application's source code from GitHub. It allows human editing, commenting, and annotation on top of AI-generated content, preserving user contributions when AI updates articles based on code changes. Built for internal teams (developers, QA engineers, product managers) who need a living, accurate source of truth.

## Core Value

AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions — the system must reliably merge AI updates with human edits.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Google OIDC authentication with role-based access (admin/user)
- [ ] GitHub integration with file tree (exclude-by-default, opt-in inclusion), AI re-index on inclusion changes, and scheduled/manual sync via cron-triggered API route
- [ ] AI processing pipeline: code analysis → article generation/update via OpenRouter
- [ ] AI + human content coexistence with merge strategy and conflict detection
- [ ] Wiki viewer with category navigation, full-text search, and Markdown rendering
- [ ] WYSIWYG editor (BlockNote) with native JSON storage and image paste/upload
- [ ] Version history with diff viewer and rollback
- [ ] Technical view linking articles to source files and database tables
- [ ] Threaded comments with @mentions
- [ ] Ask AI (global and per-article) with conversation persistence
- [ ] Notifications via Slack DM and SendGrid email
- [ ] Admin settings dashboard (GitHub config, AI prompts, user management, notification config)
- [ ] Docker deployment with local image storage

### Out of Scope

- Inline text annotations/highlighting — deferred unless BlockNote natively supports it
- Real-time collaborative editing — single-tenant, not needed for v1
- Mobile app — web-first
- Multi-tenant / SaaS features — single company, private server
- OAuth providers beyond Google — Google OIDC is the sole auth method

## Context

- **Problem:** Internal teams on a large monolith lack living documentation. Manual upkeep is unsustainable, docs go stale.
- **Approach:** AI reads code changes, generates/updates wiki articles in Markdown, humans annotate and edit on top. The merge strategy (section 7 of spec) is the critical differentiator.
- **Target users:** Developers, QA Engineers, Product Managers at a single company.
- **Deployment:** Self-hosted on a private server via Docker. Neon Postgres is remote (DATABASE_URL env var). Local filesystem for image storage.
- **Content format:** Dual-format storage. AI pipeline stores `contentMarkdown` (source of truth for AI operations). `contentJson` (BlockNote JSON) is populated when the user first opens the editor — it becomes the source of truth for editing. See "Content Storage Lifecycle" in Key Decisions.
- **Spec document:** Full spec at `docs/ultrawiki-spec.md` (v0.2.2-draft, 2026-02-13). Includes complete database schema, AI prompts, and implementation checklist.

## Constraints

- **Tech stack:** Next.js 14+ (App Router), shadcn/ui + Tailwind, Drizzle ORM, Neon Postgres, NextAuth.js v5, OpenRouter, BlockNote, sharp
- **Single-tenant:** One company on a private server, not a commercial product
- **Open-source first:** Highly-adopted, well-starred libraries preferred
- **BlockNote-native editing:** Editor uses BlockNote JSON; AI pipeline uses Markdown. Both stored, each authoritative in its domain
- **No external storage:** Images stored on local filesystem, served via API route
- **Database:** Neon Postgres (remote), connection via DATABASE_URL env var — not stored in site_settings

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Content Storage Lifecycle (dual-format) | AI pipeline stores `contentMarkdown` only (`contentJson = null`). `@blocknote/server-util` cannot run in RSC/Turbopack (createContext crash). Conversion to BlockNote JSON is deferred to the editor (client-side). Once user edits, `contentJson` becomes authoritative for editing; `contentMarkdown` is regenerated on save for AI merge operations. When AI re-updates an article, it merges on markdown and resets `contentJson` to null. | Decided |
| BlockNote as editor with native JSON storage | Modern WYSIWYG, active development. Store BlockNote JSON natively — no lossy Markdown round-trip. Milkdown fallback dropped. | Decided |
| Cron-triggered API route for sync (replaced pgboss) | Sync runs once a week — no need for a persistent job queue supervisor. Simple cron hits an API route, sync runs to completion. | Decided |
| OpenRouter as AI gateway | Model-agnostic, single API key, configurable model | — Pending |
| Local filesystem for images | Simple, no external service, Docker volume mount | — Pending |
| site_settings key-value table for config | Flexible, admin-editable, secrets masked in UI | — Pending |
| Five admin-editable AI prompts | Analysis, article style, file summary, global Ask AI, page-level Ask AI — all customizable | — Pending |
| Dual AI models (primary + summary) | Primary model for article generation/merge. Separate "summary model" (efficient/fast) for short outputs like file summaries. Both configurable via OpenRouter settings. | Decided |
| Category-aware article generation | AI receives full category tree + article index as context. Must prefer existing categories over creating new ones — wiki organization coherence is critical. | Decided |
| AI review annotations after merge | After deterministic merge, LLM reviews for semantic issues (contradictions, stale human content). Never modifies content — stores annotations in separate `ai_review_annotations` table referencing section headings. Rendered as collapsible banner + section highlights. | Decided |

---
*Last updated: 2026-02-13 after initialization*
