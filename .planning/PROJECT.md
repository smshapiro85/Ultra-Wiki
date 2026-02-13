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
- [ ] GitHub integration with file sync, exclusion rules, and scheduled/manual sync via pgboss
- [ ] AI processing pipeline: code analysis → article generation/update via OpenRouter
- [ ] AI + human content coexistence with merge strategy and conflict detection
- [ ] Wiki viewer with category navigation, full-text search, and Markdown rendering
- [ ] WYSIWYG Markdown editor (BlockNote, fallback Milkdown) with image paste/upload
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
- **Content format:** All content stored as raw Markdown — no proprietary formats.
- **Spec document:** Full spec at `docs/ultrawiki-spec.md` (v0.2.2-draft, 2026-02-13). Includes complete database schema, AI prompts, and implementation checklist.

## Constraints

- **Tech stack:** Next.js 14+ (App Router), shadcn/ui + Tailwind, Drizzle ORM, Neon Postgres, NextAuth.js v5, OpenRouter, pgboss, BlockNote (fallback Milkdown), sharp — all specified in spec
- **Single-tenant:** One company on a private server, not a commercial product
- **Open-source first:** Highly-adopted, well-starred libraries preferred
- **Markdown-native:** All content as raw Markdown, no proprietary formats
- **No external storage:** Images stored on local filesystem, served via API route
- **Database:** Neon Postgres (remote), connection via DATABASE_URL env var — not stored in site_settings

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BlockNote as primary editor (Milkdown fallback) | Modern WYSIWYG, active development, high GitHub stars. Milkdown if Markdown round-trip is insufficient | — Pending |
| pgboss for job scheduling | Postgres-backed, no additional infrastructure, cron + retries + concurrency built in | — Pending |
| OpenRouter as AI gateway | Model-agnostic, single API key, configurable model | — Pending |
| Local filesystem for images | Simple, no external service, Docker volume mount | — Pending |
| site_settings key-value table for config | Flexible, admin-editable, secrets masked in UI | — Pending |
| Four admin-editable AI prompts | Analysis, article style, global Ask AI, page-level Ask AI — all customizable | — Pending |

---
*Last updated: 2026-02-13 after initialization*
