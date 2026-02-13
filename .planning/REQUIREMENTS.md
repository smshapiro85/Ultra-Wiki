# Requirements: CodeWiki

**Defined:** 2026-02-13
**Core Value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Users

- [ ] **AUTH-01**: User can log in via Google OIDC (sole authentication method)
- [ ] **AUTH-02**: First user to log in automatically becomes admin
- [ ] **AUTH-03**: Admin can promote/demote users between admin and user roles
- [ ] **AUTH-04**: User can edit display name and avatar in profile
- [ ] **AUTH-05**: User can configure personal notification preferences (Slack, email, mention, activity)

### Admin Settings

- [ ] **ADMIN-01**: Admin can configure GitHub repo URL and API key (masked input)
- [ ] **ADMIN-02**: Admin can configure OpenRouter API key and model name with test connection
- [ ] **ADMIN-03**: Admin can edit all four AI prompts (analysis, article style, global Ask AI, page-level Ask AI)
- [ ] **ADMIN-04**: Admin can configure sync schedule (cron expression) with human-readable preview
- [ ] **ADMIN-05**: Admin can configure SendGrid API key/from email and Slack bot token with test buttons
- [ ] **ADMIN-06**: Admin can view user list, promote/demote roles, see user activity overview
- [ ] **ADMIN-07**: Secret values are masked in admin UI — full values never sent to frontend

### GitHub Integration

- [ ] **GHUB-01**: System fetches and stores repo file tree from GitHub via Octokit
- [ ] **GHUB-02**: Admin can browse visual file tree and exclude/include files and folders (checkbox UI)
- [ ] **GHUB-03**: Exclusion rules persist across syncs — new files in excluded directories stay excluded
- [ ] **GHUB-04**: System detects changed/added/removed files via SHA comparison (incremental sync)
- [ ] **GHUB-05**: Admin can trigger manual sync with status/progress indicator
- [ ] **GHUB-06**: Scheduled sync runs via pgboss cron (expression from admin settings)
- [ ] **GHUB-07**: Sync has concurrency lock (one at a time), automatic retries with exponential backoff
- [ ] **GHUB-08**: Sync history visible in admin UI (from sync_logs table)
- [ ] **GHUB-09**: Job dashboard in admin UI showing pgboss job status (pending, active, completed, failed)

### AI Processing Pipeline

- [ ] **AIPL-01**: System analyzes changed files and determines which articles to create or update
- [ ] **AIPL-02**: AI generates article content in Markdown following the configurable article style prompt
- [ ] **AIPL-03**: AI generates technical view markdown (related files, DB tables, architecture notes) per article
- [ ] **AIPL-04**: AI populates article-file links and article-DB table mappings from analysis output
- [ ] **AIPL-05**: AI suggests categories for new articles during generation
- [ ] **AIPL-06**: For human-edited articles, AI uses merge strategy: compute human diff, generate new AI content, merge preserving human edits
- [ ] **AIPL-07**: Conflicts between human edits and code changes are detected and flagged with visible review banner
- [ ] **AIPL-08**: User can dismiss the review banner after reviewing changes

### Wiki Viewer

- [ ] **VIEW-01**: Left sidebar with collapsible category/article tree navigation
- [ ] **VIEW-02**: Breadcrumb navigation showing article hierarchy path
- [ ] **VIEW-03**: Article content rendered from Markdown with syntax highlighting for code blocks
- [ ] **VIEW-04**: Tab system on each article: Article | Technical View | Comments | History
- [ ] **VIEW-05**: Article metadata sidebar showing last updated, last editor, AI/human badge, category
- [ ] **VIEW-06**: Full-text search (Postgres tsvector) with result highlighting and relevance ranking
- [ ] **VIEW-07**: Search-as-you-type with debouncing
- [ ] **VIEW-08**: Auto-generated table of contents from article headings (sticky sidebar or top-of-article)
- [ ] **VIEW-09**: Home page/dashboard with recent updates, search bar, and bookmarked articles
- [ ] **VIEW-10**: Responsive layout (sidebar collapses on mobile)

### Article Editing

- [ ] **EDIT-01**: WYSIWYG Markdown editor using BlockNote (fallback to Milkdown if Markdown round-trip insufficient)
- [ ] **EDIT-02**: Editor exports raw Markdown — all content stored as Markdown in database
- [ ] **EDIT-03**: Editor toolbar: headings, bold, italic, code, links, tables, lists, images
- [ ] **EDIT-04**: Image paste/upload with auto-compression (sharp: max 1200x1200, JPEG quality 80, EXIF stripped)
- [ ] **EDIT-05**: Images stored on local filesystem (/data/images/{articleId}/), served via API route
- [ ] **EDIT-06**: Auto-save draft to localStorage with explicit Save action
- [ ] **EDIT-07**: On save: creates article_versions record, sets has_human_edits flag, updates timestamps, prompts for optional change summary

### Version History

- [ ] **VERS-01**: Full version history for every article change (AI and human)
- [ ] **VERS-02**: Diff viewer with side-by-side and inline modes
- [ ] **VERS-03**: Version restore (rollback) to any previous version
- [ ] **VERS-04**: Filter version history by change source (ai_generated, human_edited, ai_merged)
- [ ] **VERS-05**: Each version stores full content markdown and unified diff from previous

### Technical View

- [ ] **TECH-01**: Tab displaying related source files with AI-generated relevance explanations
- [ ] **TECH-02**: Files are clickable links (GitHub deep links or content modal)
- [ ] **TECH-03**: Related DB tables displayed in structured format with column details and relevance notes
- [ ] **TECH-04**: Technical view content is human-editable (same Markdown editor as articles)

### Comments & Mentions

- [ ] **CMNT-01**: Threaded comment system on each article's Comments tab
- [ ] **CMNT-02**: Markdown rendering in comment body
- [ ] **CMNT-03**: User avatar, display name, and timestamp on each comment
- [ ] **CMNT-04**: Comments can be resolved/unresolved by any user
- [ ] **CMNT-05**: @mention autocomplete dropdown triggered by typing @
- [ ] **CMNT-06**: Mentions stored in mentions table and trigger notifications per user preferences

### Ask AI

- [ ] **ASKI-01**: Global Ask AI accessible from any page via persistent header button/icon
- [ ] **ASKI-02**: Global Ask AI receives articles index (titles, slugs, descriptions) as context
- [ ] **ASKI-03**: Page-level Ask AI scoped to current article + technical view + source files + DB tables
- [ ] **ASKI-04**: Streaming response rendering with Markdown formatting
- [ ] **ASKI-05**: Conversations persisted per user in ai_conversations table (global and per-article)
- [ ] **ASKI-06**: User can continue previous conversation, start new one, or delete conversations
- [ ] **ASKI-07**: Context indicator showing what context was used for each response

### Notifications

- [ ] **NOTF-01**: Slack DM notifications via Bot token (user provides their Slack user ID)
- [ ] **NOTF-02**: Email notifications via SendGrid (admin configures API key and from email)
- [ ] **NOTF-03**: @mention in comment triggers notification to mentioned user
- [ ] **NOTF-04**: New comment on article notifies users who have commented on or edited that article
- [ ] **NOTF-05**: AI sync update notifies users who have edited the updated article
- [ ] **NOTF-06**: AI conflict flag notifies users who have edited the conflicted article

### Infrastructure

- [ ] **INFR-01**: Docker deployment with single container (Next.js app + in-process pgboss worker)
- [ ] **INFR-02**: Local volume mount for image storage (/data/images mapped to host)
- [ ] **INFR-03**: Dual Neon Postgres connections: pooled (DATABASE_URL) for app, direct (DATABASE_URL_UNPOOLED) for pgboss

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search Enhancement

- **SRCH-01**: Semantic search using pgvector for meaning-based queries
- **SRCH-02**: Hybrid search combining tsvector keyword + pgvector semantic, with combined scoring

### Content Management

- **CONT-01**: Article templates for manual content creation (Business Rules, How-To, ADR)
- **CONT-02**: Recently viewed articles list in sidebar or profile
- **CONT-03**: Backlinks showing which articles reference the current article
- **CONT-04**: Article bookmarks/favorites with star icon and "My Favorites" section
- **CONT-05**: Content staleness detection with review reminders and verification intervals
- **CONT-06**: Article ownership (owner_id) with accountability for accuracy

### Export & Analytics

- **EXPT-01**: Export article to Markdown file
- **EXPT-02**: Export article to PDF
- **ANLC-01**: Usage analytics dashboard (most read, search miss rate, content gaps)
- **ANLC-02**: Article reactions/feedback (thumbs up/down)

### UX Enhancement

- **UXEN-01**: Global keyboard shortcuts (Cmd+K search, Cmd+E edit, Cmd+S save)
- **UXEN-02**: Tagging system for cross-cutting article categorization
- **UXEN-03**: Reading time estimate per article

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaborative editing | Enormous CRDT/OT complexity; single-tenant with small team makes concurrent editing rare. Optimistic locking sufficient. |
| Inline text annotations/highlighting | Position tracking breaks when AI updates articles. Deferred unless BlockNote natively supports. |
| Custom wiki themes/branding | Theming adds zero functional value for internal tool. Logo + primary color override sufficient. |
| Plugin/extension system | Single-tenant — features go in the codebase directly. Plugin API surface area too large. |
| Multi-tenant / SaaS | Built for one company on a private server. Not a commercial product. |
| Mobile app | Web-first. Responsive layout covers mobile use cases. |
| OAuth beyond Google | Google OIDC is the sole auth method per spec. |
| Import from Confluence/Notion | Each source has different export format. AI will regenerate most content from code anyway. |
| Real-time chat between users | This is Slack. Comments + Slack integration cover the need. |
| Granular per-article permissions | Single-company tool — security boundary is "logged in." Binary visibility at most. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| ADMIN-03 | Phase 2 | Pending |
| ADMIN-04 | Phase 2 | Pending |
| ADMIN-05 | Phase 2 | Pending |
| ADMIN-06 | Phase 2 | Pending |
| ADMIN-07 | Phase 2 | Pending |
| GHUB-01 | Phase 2 | Pending |
| GHUB-02 | Phase 2 | Pending |
| GHUB-03 | Phase 2 | Pending |
| GHUB-04 | Phase 2 | Pending |
| GHUB-05 | Phase 2 | Pending |
| GHUB-06 | Phase 2 | Pending |
| GHUB-07 | Phase 2 | Pending |
| GHUB-08 | Phase 2 | Pending |
| GHUB-09 | Phase 2 | Pending |
| AIPL-01 | Phase 3 | Pending |
| AIPL-02 | Phase 3 | Pending |
| AIPL-03 | Phase 3 | Pending |
| AIPL-04 | Phase 3 | Pending |
| AIPL-05 | Phase 3 | Pending |
| AIPL-06 | Phase 3 | Pending |
| AIPL-07 | Phase 3 | Pending |
| AIPL-08 | Phase 3 | Pending |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Pending |
| VIEW-04 | Phase 4 | Pending |
| VIEW-05 | Phase 4 | Pending |
| VIEW-06 | Phase 4 | Pending |
| VIEW-07 | Phase 4 | Pending |
| VIEW-08 | Phase 4 | Pending |
| VIEW-09 | Phase 4 | Pending |
| VIEW-10 | Phase 4 | Pending |
| EDIT-01 | Phase 5 | Pending |
| EDIT-02 | Phase 5 | Pending |
| EDIT-03 | Phase 5 | Pending |
| EDIT-04 | Phase 5 | Pending |
| EDIT-05 | Phase 5 | Pending |
| EDIT-06 | Phase 5 | Pending |
| EDIT-07 | Phase 5 | Pending |
| VERS-01 | Phase 5 | Pending |
| VERS-02 | Phase 5 | Pending |
| VERS-03 | Phase 5 | Pending |
| VERS-04 | Phase 5 | Pending |
| VERS-05 | Phase 5 | Pending |
| TECH-01 | Phase 6 | Pending |
| TECH-02 | Phase 6 | Pending |
| TECH-03 | Phase 6 | Pending |
| TECH-04 | Phase 6 | Pending |
| CMNT-01 | Phase 6 | Pending |
| CMNT-02 | Phase 6 | Pending |
| CMNT-03 | Phase 6 | Pending |
| CMNT-04 | Phase 6 | Pending |
| CMNT-05 | Phase 6 | Pending |
| CMNT-06 | Phase 6 | Pending |
| ASKI-01 | Phase 7 | Pending |
| ASKI-02 | Phase 7 | Pending |
| ASKI-03 | Phase 7 | Pending |
| ASKI-04 | Phase 7 | Pending |
| ASKI-05 | Phase 7 | Pending |
| ASKI-06 | Phase 7 | Pending |
| ASKI-07 | Phase 7 | Pending |
| NOTF-01 | Phase 7 | Pending |
| NOTF-02 | Phase 7 | Pending |
| NOTF-03 | Phase 7 | Pending |
| NOTF-04 | Phase 7 | Pending |
| NOTF-05 | Phase 7 | Pending |
| NOTF-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 77 total
- Mapped to phases: 77
- Unmapped: 0

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation*
