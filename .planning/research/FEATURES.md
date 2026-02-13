# Feature Research

**Domain:** AI-augmented internal wiki / code documentation platform
**Researched:** 2026-02-13
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

#### Content & Reading

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| Markdown rendering with syntax highlighting | Every modern wiki renders Markdown; devs expect code blocks to look right | LOW | COVERED | react-markdown + rehype plugins. Ensure GFM tables, task lists, footnotes all work. |
| Auto-generated table of contents | Users found TOC "essential to the reading experience" for navigation and context-setting (MediaWiki research). Long articles are unreadable without it. | LOW | MISSING | Generate from headings in rendered Markdown. Sticky/persistent sidebar TOC with active section highlighting. Add this -- it is trivial and high-impact. |
| Full-text search with result highlighting | 78% of engineers cite outdated information as #1 trust killer; after that, search failure is the top reason wikis get abandoned (FullScale). Users expect Google-quality speed. | MEDIUM | COVERED | Postgres tsvector is fine for v1. Search-as-you-type with debounce is in spec. |
| Category/hierarchy navigation | Users expect to browse by topic, not just search. Sidebar tree is the standard pattern (Confluence, GitBook, Outline, Notion). | MEDIUM | COVERED | Left sidebar with collapsible category tree + nested articles + breadcrumbs. |
| Article metadata display | Users expect to see who wrote it, when it was last updated, and whether it is trustworthy. Staleness awareness is critical for documentation trust. | LOW | COVERED | Last updated, editor, AI/human badge in sidebar. |
| Responsive/mobile-friendly layout | Users will read docs on tablets and phones during meetings, standups, and hallway conversations. Not building a mobile app is fine; broken layout is not. | MEDIUM | PARTIALLY COVERED | Spec mentions sidebar collapses on mobile, but no other responsive considerations. Ensure article content, search, and comments all work on small screens. |

#### Authoring & Editing

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| WYSIWYG Markdown editor | Non-dev users (PMs, QA) need visual editing. Raw Markdown is a barrier. Every modern wiki offers this (Notion, Slab, Outline, GitBook). | HIGH | COVERED | BlockNote with Milkdown fallback. The editor choice is the riskiest table-stakes item -- validate Markdown fidelity early. |
| Image paste/upload | Users expect clipboard paste to "just work." Standard in Notion, Confluence, Slack. | MEDIUM | COVERED | Sharp processing pipeline, local storage. Well-specified. |
| Version history with diff and rollback | Users need confidence they can undo mistakes. Every serious wiki (Confluence, MediaWiki, Outline, GitBook) has this. | MEDIUM | COVERED | Full version history with side-by-side/inline diff, rollback, change source filtering. Thorough spec. |
| Auto-save / draft recovery | Users expect not to lose work. Browser crash, accidental navigation, session timeout -- all must be survivable. | LOW | COVERED | localStorage drafts with explicit save. Consider also server-side draft persistence for cross-device. |

#### Access & Security

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| SSO / corporate authentication | Internal tools must use company identity. No separate passwords. Google OIDC is sufficient for single-tenant. | MEDIUM | COVERED | NextAuth.js v5 with Google OIDC. First-user-is-admin. |
| Role-based access control | Admins need different capabilities than regular users. Standard in every enterprise tool. | LOW | COVERED | Two roles: admin/user. Sufficient for single-tenant. |
| Article-level permissions | ABSENT but acceptable | LOW | NOT IN SPEC | Single-tenant internal tool -- everyone can see everything. This is the right call. Only add if the company has sensitive content divisions. Do NOT build this for v1. |

#### Collaboration

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| Comments on articles | Users need to ask questions, flag errors, discuss content. Standard in Confluence, Notion, GitBook. | MEDIUM | COVERED | Threaded comments with Markdown support, resolve/unresolve. |
| @mentions with notifications | Users expect to tag people for attention. Standard in every collaboration tool. | MEDIUM | COVERED | Autocomplete on @, notification triggers. |
| Notifications (multi-channel) | Users need to know when content they care about changes. Slack is where dev teams live. | MEDIUM | COVERED | Slack DM + SendGrid email. Per-user preferences. |

#### Admin & Operations

| Feature | Why Expected | Complexity | Spec Status | Notes |
|---------|--------------|------------|-------------|-------|
| Admin settings dashboard | Self-hosted tools need a configuration UI. No one wants to edit env vars for routine changes. | MEDIUM | COVERED | Key-value settings with masked secrets, prompt editors, user management. |
| Sync status and logs | Admins need visibility into automated processes. "Is it working? When did it last run? What failed?" | MEDIUM | COVERED | sync_logs table, job queue dashboard, progress indicator. |
| Docker deployment | Self-hosted means easy deployment. Docker Compose is the standard. | LOW | COVERED | Single container + remote Neon Postgres. Simple. |

---

### Differentiators (Competitive Advantage)

Features that set CodeWiki apart. These are why someone would use CodeWiki over Confluence, Notion, Outline, or GitBook.

| Feature | Value Proposition | Complexity | Spec Status | Notes |
|---------|-------------------|------------|-------------|-------|
| Auto-generate articles from source code | THE core differentiator. No other major wiki does this. DeepWiki generates docs from repos but is read-only/external-facing. Swimm couples docs to code but requires manual authoring. Mintlify monitors codebases but focuses on external API docs. CodeWiki generates full internal wiki articles from code analysis -- unique positioning. | HIGH | COVERED | AI pipeline: code analysis -> article generation via OpenRouter. Well-designed JSON response format. |
| AI + human content merge strategy | Second core differentiator. The merge strategy (preserve human edits, add new AI sections, flag conflicts) is the hardest and most valuable feature. No competitor does this well. Guru has verification workflows but not AI-human merge. | HIGH | COVERED | Three-way merge: last AI version, current content, new AI content. Conflict detection and review banners. This is the most complex feature -- get it right or the product fails. |
| Technical view (file + DB table mapping) | Developers can see exactly which source files and database tables relate to an article. No other wiki links documentation back to code at this granularity. | MEDIUM | COVERED | article_file_links and article_db_tables with GitHub deep links. Editable by both AI and humans. |
| Page-level Ask AI with source code context | Most AI wikis offer generic Q&A. CodeWiki's page-level Ask AI includes the actual source files and DB schemas as context -- answers are grounded in the code, not just the documentation. | MEDIUM | COVERED | Context assembly: article + technical view + source files + DB tables. Much richer than competitors. |
| Admin-editable AI prompts | Lets admins tune AI behavior without code changes. Most AI tools are black boxes. This gives the team control over article tone, structure, analysis depth. | LOW | COVERED | Four editable prompts in site_settings. Good decision. |
| Scheduled + manual code sync | Automated freshness with manual override. The cron + manual trigger pattern is well-designed. | MEDIUM | COVERED | pgboss cron scheduling with manual trigger, concurrency lock, retry logic. |

---

### Features Missing from Spec (Gaps to Address)

These are features that the competitive landscape strongly suggests CodeWiki should have, ordered by impact.

#### HIGH Impact Gaps

| Feature | Why Important | Complexity | Recommendation |
|---------|---------------|------------|----------------|
| **Auto-generated Table of Contents** | Every wiki user expects in-page navigation for long articles. MediaWiki, Confluence, Notion, GitBook, Outline all have this. Articles about business rules will be long. Without TOC, users scroll blindly. | LOW | ADD TO SPEC. Generate from h2/h3 headings. Render as sticky sidebar or top-of-article outline. Active section highlighting as user scrolls. Trivial to build, massive UX improvement. |
| **Article bookmarks / favorites** | Users repeatedly access the same 5-10 articles. Confluence has "starred pages," Notion has "favorites," Outline has "starred." Without this, users rely on browser bookmarks (fragile) or search every time. | LOW | ADD TO SPEC. Simple user-article junction table. Star icon on articles. "My Favorites" section in sidebar or profile. |
| **Content staleness detection and review reminders** | 78% of engineers cite outdated information as the top trust-killer (FullScale research). Guru's verification workflow, Document360's content health scores, and Slab's content freshness indicators all address this. Even with AI auto-updates, some articles won't have corresponding code changes but may still go stale (process docs, architecture decisions, team knowledge). | MEDIUM | ADD TO SPEC. Track `last_verified_at` and `verified_by` on articles. Allow setting a verification interval (e.g., 90 days). Surface stale articles in admin dashboard. Notify article owners when verification is due. This complements the AI auto-update beautifully -- AI handles code-linked staleness, verification handles everything else. |
| **Article ownership / content owners** | Without clear owners, no one is accountable and the knowledge base becomes chaotic (every KB best-practice guide emphasizes this). Guru requires owners. AllAnswered requires review cycle owners. The spec has `last_human_editor_id` but no concept of an ongoing owner responsible for accuracy. | LOW | ADD TO SPEC. Add `owner_id` (FK to users) on articles. Owner gets notified on AI updates, conflicts, and staleness reminders. Owner can be assigned by admin or self-claimed. Different from "last editor" -- ownership is ongoing responsibility. |
| **Semantic search (vector/RAG)** | Postgres full-text search (tsvector) is keyword-based. Users increasingly expect "semantic" search -- finding content by meaning, not just keyword match. A query for "how do we handle expired accounts" should find an article titled "User Deactivation Business Rules." Neon Postgres supports pgvector natively, and the spec already uses Neon. | MEDIUM | ADD TO v1.x (NOT MVP). Requires generating embeddings via OpenRouter/OpenAI and storing in pgvector. Use hybrid search: tsvector for keyword, pgvector for semantic, combine scores. This also dramatically improves Ask AI context retrieval. Defer to after core wiki is working, but architect the search layer to accommodate it. |

#### MEDIUM Impact Gaps

| Feature | Why Important | Complexity | Recommendation |
|---------|---------------|------------|----------------|
| **Article templates** | Every major wiki (Confluence, Notion, Document360) offers templates for standardized content. For CodeWiki, the AI generates initial articles, but humans may want to create manual articles too. Templates ensure consistency. | LOW | ADD TO SPEC. The article_style_prompt partially addresses this for AI content. For human-authored articles, provide 2-3 Markdown templates (e.g., "Business Rules," "How-To Guide," "Architecture Decision Record"). Templates are just pre-filled Markdown -- minimal implementation cost. |
| **Recently viewed / activity feed** | Users need "what was I reading yesterday?" and "what changed recently?" Confluence has "recently viewed" and "recent activity." Notion has "updates." Helps users stay oriented in a growing wiki. | LOW | ADD TO SPEC. Track user article views (simple page view log). Show "Recently Viewed" in sidebar. Show "Recently Updated" on home/dashboard. The spec mentions "Activity feed" in Phase 10 polish -- promote it to a core navigation feature. |
| **Export to PDF / Markdown** | Data portability matters. Users occasionally need to share wiki content with people who don't have access (contractors, auditors, stakeholders). Document360, MediaWiki, and GitBook all support PDF export. | LOW | ADD TO v1.x. Content is already Markdown -- export is trivial. PDF export via a library like `md-to-pdf` or server-side rendering. Not MVP-blocking but users will ask for it within weeks. |
| **Backlinks / related articles** | When article A references article B, article B should show "Referenced by: Article A." Notion, Outline, and Roam popularized this pattern. Helps users discover related content and understand the knowledge graph. | MEDIUM | ADD TO SPEC. Parse Markdown content for internal wiki links during save. Store in a junction table. Display "Referenced by" section on articles. The AI can also suggest related articles during generation. |
| **Home page / dashboard** | Users need a landing page when they open the wiki. Not just an article list -- a curated view showing recent updates, pinned articles, quick search, and possibly AI-suggested content. Confluence has a "space home," Notion has "home." | LOW | ADD TO SPEC. Currently the spec has no concept of a home/landing page. Build a simple dashboard: search bar, recently updated articles, bookmarked articles, and a "getting started" section for new users. |
| **Global keyboard shortcuts** | Developers expect Cmd+K for quick search/navigation (Notion, Slack, Linear, Spotlight). This is a small feature with outsized impact on power user experience. | LOW | ADD TO SPEC. Cmd+K for quick search/navigate. Cmd+E for edit. Cmd+S for save. Escape to close panels. Standard patterns, minimal implementation. |

#### LOW Impact Gaps (Consider for v2+)

| Feature | Why Important | Complexity | Recommendation |
|---------|---------------|------------|----------------|
| **Reading time estimate** | Small quality-of-life feature. Shows "5 min read" on articles. Helps users decide whether to read now or bookmark for later. | TRIVIAL | DEFER. Nice-to-have. Calculate from word count. |
| **Article reactions / feedback** | Thumbs up/down or emoji reactions on articles. Helps surface which articles are useful and which need improvement. Document360 has article feedback ratings. | LOW | DEFER to v1.x. Simple to build but not essential. Analytics (if added) are more valuable for content quality signals. |
| **Usage analytics dashboard** | Which articles get read most? What do people search for but not find? Where are the content gaps? Slab, Document360, and Guru all offer this. | MEDIUM | DEFER to v1.x. Requires page view tracking, search query logging, and a reporting UI. Valuable but not launch-blocking. |
| **Multi-language support** | Translations, RTL support. Outline supports 20 languages. Guru auto-translates to 100+. | HIGH | DEFER or NEVER for v1. Single-tenant, single-company. Only build if the team is multilingual. |
| **Tagging system** | Articles tagged with keywords beyond category hierarchy. Useful for cross-cutting concerns (e.g., an article might be in "Jobs" category but tagged "permissions," "admin," "settings"). | LOW | DEFER to v1.x. Categories + search cover most use cases for v1. Tags add value once the wiki has 100+ articles. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaborative editing** | "Google Docs does it." Teams expect it in 2026. | Enormous complexity (CRDT/OT algorithms, WebSocket infrastructure, cursor presence). Single-tenant with small team -- concurrent editing of the same article is rare. The spec already has optimistic locking for conflict detection. Building real-time collab would double the project timeline. | Optimistic locking with "someone else is editing" warning. Lock indicator showing who is currently editing. This covers 99% of the actual need. |
| **Inline text annotations / highlighting** | Users want to highlight specific sentences and attach comments, like Google Docs or Hypothesis. | Spec already defers this correctly. Annotations require position tracking that breaks when content changes (especially when AI updates articles). The interaction between inline annotations and AI content merge is a nightmare. Every position shifts when AI rewrites a paragraph. | Article-level threaded comments with quote-reply (user quotes the relevant text in their comment). Covers the use case without the complexity. |
| **Custom wiki themes / extensive branding** | "We want it to look like our brand." | Theming infrastructure is a time sink that delivers zero functional value for an internal tool. Users want usable, not branded. | Support a logo upload and primary color override in admin settings. Shadcn/ui theming handles the rest. Two fields, not a theme engine. |
| **Plugin / extension system** | "We want to extend it ourselves." | Plugin architecture requires stable APIs, sandboxing, documentation, version compatibility management. Massively increases surface area for bugs. Single-tenant tool for one team -- if they need a feature, it goes in the codebase. | Open source. The team can fork/extend directly. API routes for integration with external tools. |
| **WYSIWYG editing of AI prompts** | "Let non-technical admins edit prompts visually." | AI prompts are inherently technical. Template variables ({{changes_summary}}) need to be preserved exactly. WYSIWYG would obscure the template syntax and lead to broken prompts. | Plain text editor with syntax highlighting for template variables. Show available variables as a reference sidebar. Preview with sample data. |
| **Granular per-article permissions** | "Some articles should be admin-only." | Permission complexity explodes. Every query needs permission checks. Search results need filtering. The sidebar tree needs visibility rules. For a single-company internal tool, the security boundary is "logged in." | If truly needed, add a simple `visibility` enum (public/admin-only) on articles -- binary, not a full ACL system. But do not build this for v1. |
| **Import from Confluence / Notion / other wikis** | "We have existing docs we want to migrate." | Every wiki has a different export format. Confluence exports are XML with embedded macros. Notion exports are nested Markdown with IDs. Building robust importers is a multi-week project per source. | Provide a simple "Create article from Markdown" API endpoint. Users can manually copy/paste or write a one-off migration script. The AI will eventually regenerate most content from code anyway. |
| **Chat-style real-time messaging between users** | "We want Slack inside the wiki." | This is Slack. Do not rebuild Slack. Chat and documentation are fundamentally different modes of communication. | Comments on articles for async discussion. Slack integration for notifications. Link to Slack channels from articles if needed. |

---

## Feature Dependencies

```
[Auth + User Management]
    |
    +---> [Admin Settings Dashboard]
    |         |
    |         +---> [GitHub Integration + File Sync]
    |         |         |
    |         |         +---> [AI Processing Pipeline]
    |         |                   |
    |         |                   +---> [Article Generation]
    |         |                   |         |
    |         |                   |         +---> [AI + Human Merge Strategy]
    |         |                   |
    |         |                   +---> [Technical View (file/DB mapping)]
    |         |
    |         +---> [AI Prompt Configuration]
    |         |
    |         +---> [Notification Config (Slack/Email)]
    |
    +---> [Wiki Viewer + Navigation]
    |         |
    |         +---> [Full-Text Search]
    |         |
    |         +---> [Article View + Tabs]
    |         |         |
    |         |         +---> [Article Editor + Images]
    |         |         |         |
    |         |         |         +---> [Version History + Diff]
    |         |         |
    |         |         +---> [Technical View Tab]
    |         |         |
    |         |         +---> [Comments Tab]
    |         |                   |
    |         |                   +---> [@Mentions]
    |         |                            |
    |         |                            +---> [Notifications]
    |         |
    |         +---> [Table of Contents] (enhances Article View)
    |         |
    |         +---> [Bookmarks/Favorites] (enhances Navigation)
    |         |
    |         +---> [Home Page / Dashboard] (enhances Navigation)
    |
    +---> [Ask AI (Global)]
    |         |
    |         +---> [Ask AI (Page-Level)] (requires Article View)
    |
    +---> [Content Staleness Detection] (requires Article Ownership)
              |
              +---> [Semantic Search / RAG] (enhances Search + Ask AI)
```

### Dependency Notes

- **AI Pipeline requires GitHub Sync:** Articles cannot be generated until code is synced and analyzed. The entire left branch of the tree must be built first.
- **AI + Human Merge requires Article Generation:** The merge strategy only matters once both AI and human content exist. Build generation first, then merge.
- **Ask AI (Page-Level) requires Article View + Technical View:** The page-level context assembly needs articles, technical views, and source files all in place.
- **Notifications require Comments + Mentions:** Notification triggers depend on comment and mention events. Build the events before the notification system.
- **Semantic Search enhances but does not block:** Full-text search is sufficient for launch. Semantic search is an enhancement that makes Ask AI better but is not a dependency.
- **Content Staleness is independent of AI updates:** AI handles code-linked freshness. Staleness detection handles process docs, architecture decisions, and other non-code-linked content. They are complementary, not dependent.
- **Table of Contents conflicts with nothing:** Pure frontend rendering from heading structure. Can be added at any point, but should be in v1 given its impact.

---

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate the concept.

- [ ] **Auth + roles** -- Google OIDC, admin/user roles (foundation for everything)
- [ ] **Admin settings** -- Configuration UI for all integrations and prompts
- [ ] **GitHub file sync** -- Fetch, filter, diff, store code from repo
- [ ] **AI article generation** -- Analyze code changes, generate/update articles
- [ ] **AI + human merge** -- Preserve human edits during AI updates with conflict detection
- [ ] **Wiki viewer** -- Category navigation, article rendering, metadata, TOC
- [ ] **Full-text search** -- Postgres tsvector with result highlighting
- [ ] **Article editor** -- BlockNote WYSIWYG with image paste/upload
- [ ] **Version history** -- Diff viewer and rollback
- [ ] **Technical view** -- Source files and DB tables linked to articles
- [ ] **Home page** -- Dashboard with recent updates, search, bookmarks
- [ ] **Auto-generated TOC** -- Sticky table of contents for article navigation
- [ ] **Article bookmarks** -- Star/favorite articles for quick access

### Add After Validation (v1.x)

Features to add once core is working and users provide feedback.

- [ ] **Comments + @mentions** -- Add when team requests discussion features on articles
- [ ] **Ask AI (global + page-level)** -- Add when users want to query the knowledge base conversationally
- [ ] **Notifications (Slack + email)** -- Add when comments/mentions exist and users want push alerts
- [ ] **Content ownership + staleness detection** -- Add when wiki has 50+ articles and freshness becomes a concern
- [ ] **Semantic search (pgvector)** -- Add when keyword search proves insufficient for user queries
- [ ] **Article templates** -- Add when humans start creating articles manually (not just editing AI ones)
- [ ] **Recently viewed + activity feed** -- Add when wiki is large enough that users need orientation aids
- [ ] **Backlinks / related articles** -- Add when cross-referencing between articles becomes common
- [ ] **Export to PDF / Markdown** -- Add when users request sharing content externally
- [ ] **Keyboard shortcuts (Cmd+K)** -- Add for power user satisfaction

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Usage analytics dashboard** -- Defer until enough data to be meaningful
- [ ] **Article reactions / feedback** -- Defer until analytics infrastructure exists
- [ ] **Tagging system** -- Defer until category hierarchy proves insufficient
- [ ] **Reading time estimates** -- Trivial but low priority
- [ ] **Multi-language support** -- Only if the company needs it

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + RBAC | HIGH | MEDIUM | P1 |
| Admin settings dashboard | HIGH | MEDIUM | P1 |
| GitHub file sync + scheduling | HIGH | HIGH | P1 |
| AI article generation pipeline | HIGH | HIGH | P1 |
| AI + human merge strategy | HIGH | HIGH | P1 |
| Wiki viewer + navigation | HIGH | MEDIUM | P1 |
| Full-text search | HIGH | MEDIUM | P1 |
| WYSIWYG editor + images | HIGH | HIGH | P1 |
| Version history + diff + rollback | HIGH | MEDIUM | P1 |
| Technical view (file/DB links) | HIGH | MEDIUM | P1 |
| Auto-generated TOC | HIGH | LOW | P1 |
| Article bookmarks / favorites | MEDIUM | LOW | P1 |
| Home page / dashboard | MEDIUM | LOW | P1 |
| Threaded comments | MEDIUM | MEDIUM | P2 |
| @mentions | MEDIUM | MEDIUM | P2 |
| Ask AI (global) | HIGH | MEDIUM | P2 |
| Ask AI (page-level) | HIGH | MEDIUM | P2 |
| Notifications (Slack + email) | MEDIUM | MEDIUM | P2 |
| Content ownership | MEDIUM | LOW | P2 |
| Staleness detection + reminders | MEDIUM | MEDIUM | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| Backlinks / related articles | MEDIUM | MEDIUM | P2 |
| Article templates | MEDIUM | LOW | P2 |
| Recently viewed | LOW | LOW | P2 |
| Semantic search (pgvector) | HIGH | HIGH | P3 |
| Export to PDF / Markdown | LOW | LOW | P3 |
| Usage analytics | MEDIUM | MEDIUM | P3 |
| Article reactions | LOW | LOW | P3 |
| Tagging system | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Confluence | Notion | GitBook | Outline | Slab | Guru | Swimm | DeepWiki | **CodeWiki** |
|---------|-----------|--------|---------|---------|------|------|-------|----------|-----------|
| WYSIWYG editor | Yes | Yes (blocks) | Yes | Yes | Yes | Yes | Yes (code-coupled) | No (read-only) | **Yes (BlockNote)** |
| AI content generation | Rovo AI (basic) | Notion AI (basic) | AI docs | No | No | AI writer | No (manual) | Yes (full) | **Yes (from code)** |
| Auto-sync with codebase | No | No | Git-based (manual) | No | No | No | Yes (code snippets) | Yes (read-only) | **Yes (full articles)** |
| AI + human merge | No | No | No | No | No | No | No | No | **YES (unique)** |
| Technical view (code links) | No | No | No | No | No | No | Yes (snippets) | Yes (read-only) | **Yes (editable)** |
| Ask AI with code context | No | Basic | No | No | No | Basic | No | Yes (RAG) | **Yes (deep context)** |
| Version history | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | **Yes** |
| Threaded comments | Yes | Yes | No | Yes | Yes | No | No | No | **Yes** |
| Content verification | No | No | No | No | Content health | Yes (verification) | CI checks | No | **Planned (staleness)** |
| Semantic search | Rovo AI | Yes | Yes | Basic | Yes | Yes | No | Yes (RAG) | **Planned (pgvector)** |
| Self-hosted | Data Center | No | No | Yes | No | No | No | Yes (open source) | **Yes (Docker)** |
| SSO | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | **Yes (Google OIDC)** |
| Templates | Yes (extensive) | Yes (gallery) | Yes | Yes | Yes | Yes | No | No | **Planned** |
| Bookmarks/favorites | Yes (starred) | Yes (favorites) | No | Yes (starred) | Yes | No | No | No | **Planned** |
| Analytics | Yes | Basic | Yes | No | Yes | Yes | No | No | **Deferred** |
| Notifications | Yes | Yes | No | Yes | Yes | Yes | CI alerts | No | **Yes (Slack + email)** |

### Key Competitive Insight

CodeWiki's unique positioning is the intersection of three capabilities no competitor combines:
1. **Auto-generates internal wiki articles from code analysis** (DeepWiki is closest but is read-only and external-facing)
2. **Merges AI updates with human edits** (nobody else does this)
3. **Self-hosted with full editorial control** (Outline is self-hosted but has no AI generation)

The nearest competitors in the "code -> docs" space are:
- **DeepWiki:** Generates docs from repos but is read-only -- no editing, no human contributions, no merge strategy
- **Swimm:** Couples docs to code but requires manual authoring -- AI only keeps code snippets in sync, does not generate articles
- **Mintlify:** Monitors codebases for external API docs -- different audience (external developers, not internal team)

None of them solve the "living internal wiki that combines AI generation with human knowledge" problem.

---

## Sources

- [FullScale: Building a Technical Wiki Engineers Actually Use](https://fullscale.io/blog/build-a-technical-wiki-engineers-actually-use/) -- MEDIUM confidence (single source, but well-researched article with specific statistics)
- [Guru AI Knowledge Base Guide](https://www.getguru.com/reference/ai-knowledge-base) -- HIGH confidence (official product documentation)
- [Document360 Health Check Metrics](https://docs.document360.com/docs/health-check-metrics) -- HIGH confidence (official docs)
- [Swimm Auto-sync Documentation](https://docs.swimm.io/features/keep-docs-updated-with-auto-sync/) -- HIGH confidence (official docs)
- [DeepWiki-Open GitHub](https://github.com/AsyncFuncAI/deepwiki-open) -- HIGH confidence (official source code)
- [Mintlify Autopilot](https://www.mintlify.com/blog/autopilot) -- MEDIUM confidence (official blog)
- [Neon pgvector Guide](https://neon.com/guides/ai-embeddings-postgres-search) -- HIGH confidence (official Neon docs, directly relevant to spec's Neon Postgres choice)
- [MediaWiki Table of Contents Research](https://www.mediawiki.org/wiki/Reading/Web/Desktop_Improvements/Features/Table_of_contents/en) -- HIGH confidence (MediaWiki official user research)
- [Outline Wiki GitHub](https://github.com/outline/outline) -- HIGH confidence (open source, verifiable)
- [Siit: Best Company Wiki Software 2026](https://www.siit.io/blog/best-company-wiki-software) -- LOW confidence (comparison/review site)
- [Whatfix: Internal Wiki Guide 2026](https://whatfix.com/blog/internal-wiki/) -- LOW confidence (vendor blog)
- [Document360: Wiki Software Tools 2026](https://document360.com/blog/wiki-software/) -- LOW confidence (vendor blog, but useful for feature landscape)

---
*Feature research for: AI-augmented internal wiki / code documentation platform*
*Researched: 2026-02-13*
