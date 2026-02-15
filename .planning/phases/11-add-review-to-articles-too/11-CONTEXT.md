# Phase 11: Add Review To Articles Too - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add article-level review queue as a fifth tab on the article page, plus review item counts in the sidebar and comment counts in the Comments tab. All review features remain admin-only. Reuse the existing admin Review Queue infrastructure — no code duplication.

</domain>

<decisions>
## Implementation Decisions

### Fifth tab: Review Queue
- Add a "Review Queue" tab to the article page tab system (after Comments, before History)
- Tab label shows the count of pending review items for that article (e.g., "Review Queue (3)")
- Tab content reuses the same components from the admin Review Queue page, filtered to the current article
- Admin-only: tab only appears for admin users
- Review items include both merge conflicts (needsReview) and active AI review annotations — same as the admin page

### Comment count in tab
- The existing "Comments" tab label should show the count of comments on the article (e.g., "Comments (5)")
- This is visible to all users, not admin-only

### Sidebar review item badges
- Admin-only: articles in the sidebar show a subtle badge/indicator with the number of pending review items
- This makes it easy for admins to scan the sidebar and see which articles need attention
- Should be subtle — not an alert, more like a small count indicator
- Only visible to admin users; regular users see no badge

### Code reuse
- The admin Review Queue page at /admin/settings already has the review queue UI
- The article-level tab must reuse these same components, filtered by articleId
- Do NOT create separate components or duplicate query logic — extract shared pieces if needed and use them in both places

### Claude's Discretion
- Exact badge styling in the sidebar (color, size, position)
- Whether to extract a shared ReviewQueueList component or pass articleId as a filter prop
- How to efficiently query review item counts for sidebar badges (batch query vs per-article)

</decisions>

<specifics>
## Specific Ideas

- The sidebar badge should be small and subtle — think a small number in a muted circle, not a bright red notification badge
- Tab counts (Review Queue and Comments) should appear in parentheses after the tab name, only when count > 0
- The admin Review Queue page in site settings stays as-is — this phase adds the article-level view alongside it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-add-review-to-articles-too*
*Context gathered: 2026-02-15*
