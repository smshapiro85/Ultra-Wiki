# Phase 11: Add Review To Articles Too - Research

**Researched:** 2026-02-16
**Domain:** Article-level review queue UI, sidebar badges, tab count indicators
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add a "Review Queue" tab to the article page tab system (after Comments, before History)
- Tab label shows the count of pending review items for that article (e.g., "Review Queue (3)")
- Tab content reuses the same components from the admin Review Queue page, filtered to the current article
- Admin-only: tab only appears for admin users
- Review items include both merge conflicts (needsReview) and active AI review annotations -- same as the admin page
- The existing "Comments" tab label should show the count of comments on the article (e.g., "Comments (5)")
- Comment count is visible to all users, not admin-only
- Admin-only: articles in the sidebar show a subtle badge/indicator with the number of pending review items
- Should be subtle -- not an alert, more like a small count indicator
- Only visible to admin users; regular users see no badge
- The admin Review Queue page at /admin/settings already has the review queue UI
- The article-level tab must reuse these same components, filtered by articleId
- Do NOT create separate components or duplicate query logic -- extract shared pieces if needed and use them in both places

### Claude's Discretion
- Exact badge styling in the sidebar (color, size, position)
- Whether to extract a shared ReviewQueueList component or pass articleId as a filter prop
- How to efficiently query review item counts for sidebar badges (batch query vs per-article)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase adds article-level review queue visibility by (1) adding a fifth "Review Queue" tab to the article page tabs, (2) showing comment counts in the Comments tab label, and (3) displaying review item count badges on sidebar articles for admins. The existing infrastructure is mature and well-structured -- the admin Review Queue page at `/admin/review-queue` already has a `ReviewQueueList` client component and a `getReviewQueueItems()` query in `queries.ts`. The `ArticleTabs` component is a straightforward shadcn/ui Tabs wrapper. The sidebar uses either `SortableSidebar` (admin) or `CategoryTree` (non-admin), both rendering article items.

The core challenge is code reuse without duplication. The current `ReviewQueueList` accepts all items globally and provides search/category filter/sort controls. For the article-level tab, these controls are unnecessary (single article context). The recommendation is to extract the item rendering into a shared sub-component while letting each context (admin page vs article tab) provide its own wrapper. For sidebar badges, the most efficient approach is a single batch query that returns review counts per article, fetched once in the wiki layout and passed down.

**Primary recommendation:** Extract a shared `ReviewQueueItems` component (the card list portion) from the existing `ReviewQueueList`, create an article-scoped query `getArticleReviewQueueItems(articleId)`, and use a batch `getReviewCountsByArticle()` query for sidebar badges.

## Standard Stack

### Core (Already Installed -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| radix-ui | 1.4.3 | Tabs primitive (via shadcn/ui) | Already powers ArticleTabs |
| lucide-react | 0.564.0 | Icons (ClipboardList for Review Queue tab) | Consistent with all existing tabs |
| drizzle-orm | 0.45.1 | Database queries for counts | Already used for all data access |
| next | 16.1.6 | Server components, server actions | Framework for the entire app |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast notifications | Already used by annotation dismiss |
| tailwind-merge / clsx | 3.4.0 / 2.1.1 | Conditional class names | Badge styling |

**Installation:** No new packages required. This phase uses only existing dependencies.

## Architecture Patterns

### Current File Structure (Relevant Areas)
```
src/
├── app/
│   ├── (admin)/admin/review-queue/
│   │   ├── page.tsx                    # Admin review queue page (server component)
│   │   └── review-queue-list.tsx       # Client component with search/filter/sort
│   └── (wiki)/wiki/[articleSlug]/
│       └── page.tsx                    # Article page (server component)
├── components/wiki/
│   ├── article-tabs.tsx                # 4-tab system (Article, Technical, Comments, History)
│   ├── comments-section.tsx            # Comments tab content (client, fetches via API)
│   ├── annotation-banner.tsx           # AI review annotation banner
│   ├── app-sidebar.tsx                 # Sidebar shell (admin SortableSidebar vs CategoryTree)
│   ├── sortable-sidebar.tsx            # Admin sidebar with drag-and-drop
│   ├── sortable-item.tsx               # Individual sidebar item (renders article links)
│   └── category-tree.tsx               # Non-admin sidebar (read-only)
└── lib/wiki/
    └── queries.ts                      # getReviewQueueItems(), getArticleComments(), etc.
```

### Pattern 1: Extract Shared Review Queue Item Rendering
**What:** The existing `ReviewQueueList` in `review-queue-list.tsx` bundles item rendering with search/filter/sort controls. Extract the item card rendering into a reusable component.
**When to use:** Both admin review queue page and article-level review queue tab.
**Recommendation:** Create a shared `ReviewQueueItemCard` component (or inline since it's simple). The article tab version does NOT need search/category filter/sort since it's scoped to one article. It just needs the item list with badges and links.

**Approach A -- Minimal extraction (RECOMMENDED):**
- The existing `ReviewQueueList` in the admin page stays as-is (it works well with its global controls)
- Create a simpler `ArticleReviewQueue` client component for the article tab that fetches items via API, displays them as cards without search/filter/sort
- Share the item card markup via a small shared component or just duplicate the ~20 lines of card JSX (it's trivial)

**Approach B -- Full extraction:**
- Extract `ReviewQueueItemCard` component from `review-queue-list.tsx`
- Both admin page and article tab import this card
- Article tab wraps it in a simple list; admin page wraps it with search/filter/sort

**Recommendation: Approach A.** The card rendering is ~20 lines of JSX. The cost of creating a shared abstraction exceeds the cost of mild duplication. The two contexts have different needs (admin needs link-to-article; article tab does NOT need a link since you're already on that article). The admin `ReviewQueueList` also has `relativeTime` and other helpers that don't need to be shared.

### Pattern 2: Article-Scoped Query
**What:** New query function that returns review queue items for a single article.
**When to use:** Article review queue tab and the article page to get the count.

```typescript
// Source: Existing getReviewQueueItems() pattern in queries.ts
export async function getArticleReviewQueueItems(articleId: string): Promise<ReviewQueueItem[]> {
  const db = getDb();
  const results = await db.execute(sql`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.needs_review AS "needsReview",
      a.updated_at AS "updatedAt",
      COALESCE(ann.count, 0)::int AS "annotationCount"
    FROM articles a
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS count
      FROM ai_review_annotations
      WHERE is_dismissed = false
      GROUP BY article_id
    ) ann ON a.id = ann.article_id
    WHERE a.id = ${articleId}
      AND (a.needs_review = true OR ann.count > 0)
  `);
  return results.rows as unknown as ReviewQueueItem[];
}
```

Actually, for the article tab, we already have `article.needsReview` (from `getArticleBySlug`) and `annotationCount` (from `getActiveAnnotationCount`). The review queue tab should show the individual annotations (not just a count) plus the merge conflict status. So the tab needs:
1. Whether `needsReview` is true (already available from article data)
2. The list of active annotations (already fetched by `AnnotationBanner` via `/api/articles/[id]/annotations`)

**Key insight:** The article-level review queue tab doesn't need a new query at all for its content -- it can combine `article.needsReview` status with the annotations list (already available via the annotations API). What it DOES need is a count for the tab label, which can come from `needsReview` (0 or 1) + `annotationCount` (already fetched).

### Pattern 3: Batch Review Counts for Sidebar
**What:** A single query returning `{ articleId, reviewCount }[]` for all articles with review items, fetched once in the wiki layout.
**When to use:** Sidebar badge rendering.

```typescript
// New query in queries.ts
export async function getReviewCountsByArticle(): Promise<Map<string, number>> {
  const db = getDb();
  const results = await db.execute(sql`
    SELECT
      a.id AS "articleId",
      (CASE WHEN a.needs_review THEN 1 ELSE 0 END) +
      COALESCE(ann.count, 0)::int AS "reviewCount"
    FROM articles a
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS count
      FROM ai_review_annotations
      WHERE is_dismissed = false
      GROUP BY article_id
    ) ann ON a.id = ann.article_id
    WHERE a.needs_review = true OR ann.count > 0
  `);
  const map = new Map<string, number>();
  for (const row of results.rows as any[]) {
    map.set(row.articleId, Number(row.reviewCount));
  }
  return map;
}
```

This is fetched once in the wiki layout (alongside `getCategoryTreeWithArticles()`) and passed down to `AppSidebar` -> `SortableSidebar`/`CategoryTree` -> individual items.

### Pattern 4: Comment Count for Tab Label
**What:** A simple count query for comments on an article.
**When to use:** The "Comments (N)" tab label.

```typescript
// New query in queries.ts
export async function getArticleCommentCount(articleId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.articleId, articleId));
  return Number(result[0].count);
}
```

This is fetched server-side on the article page alongside the other parallel queries and passed to `ArticleTabs`.

### Pattern 5: Conditional Tab Rendering
**What:** The ArticleTabs component needs to conditionally render the Review Queue tab (admin-only) and show counts on tab labels.
**Current state:** ArticleTabs accepts 4 ReactNode props and renders them statically.
**Needed state:** Accept optional 5th tab content, comment count, review count, and isAdmin flag.

```typescript
interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
  commentsContent: React.ReactNode;
  historyContent: React.ReactNode;
  reviewQueueContent?: React.ReactNode; // undefined for non-admin
  commentCount?: number;
  reviewCount?: number;
}
```

### Anti-Patterns to Avoid
- **Duplicating the full ReviewQueueList:** Don't copy the admin review queue component wholesale -- it has global controls (search, category filter, sort) that make no sense in a single-article context
- **Per-article sidebar queries:** Don't fetch review counts per-article in the sidebar -- use one batch query
- **Client-side count fetching for tab labels:** Don't use useEffect + fetch for comment/review counts that determine tab labels -- fetch server-side and pass as props for instant render
- **Hiding the tab vs showing empty:** When count is 0 for admin, show the tab without a count suffix, don't hide it entirely -- admins should always see the Review Queue tab is available

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab system | Custom tab UI | Existing shadcn/ui Tabs (already in use) | Accessibility, keyboard navigation, ARIA built-in |
| Badge component | Custom styled span | Existing shadcn/ui Badge (already in use) | Consistent styling |
| Review item data | New API routes for review data | Existing annotations API + article.needsReview | Data already available through existing endpoints |

**Key insight:** Almost everything needed already exists in the codebase. This phase is about wiring existing pieces together with minimal new code, plus adding a few lightweight count queries.

## Common Pitfalls

### Pitfall 1: N+1 Query for Sidebar Badges
**What goes wrong:** Fetching review count per article in the sidebar creates N database queries for N articles.
**Why it happens:** Natural instinct to add a `getReviewCount(articleId)` call inside each sidebar item.
**How to avoid:** Use batch query `getReviewCountsByArticle()` that returns all counts in one query, pass the Map through props.
**Warning signs:** Sidebar load time increases, database connection pool saturation.

### Pitfall 2: Tab Count Flashing
**What goes wrong:** Tab labels initially show "Comments" then flash to "Comments (5)" after client-side fetch completes.
**Why it happens:** Fetching counts client-side instead of server-side.
**How to avoid:** Fetch `commentCount` and `reviewCount` server-side in the article page.tsx, pass as props to `ArticleTabs`.
**Warning signs:** Layout shift on tab labels after page load.

### Pitfall 3: Inconsistent Review Count Definition
**What goes wrong:** The sidebar badge count doesn't match the tab count because they use different counting logic.
**Why it happens:** One counts `needsReview` as 1 item, the other counts individual annotations plus needsReview.
**How to avoid:** Define clearly: review count = (needsReview ? 1 : 0) + activeAnnotationCount. Use this consistently in both the sidebar batch query and the article page count.
**Warning signs:** Badge shows "2" but tab shows "Review Queue (3)".

### Pitfall 4: Breaking ArticleTabs Interface for Non-Admin Users
**What goes wrong:** Non-admin users see a broken or empty Review Queue tab.
**Why it happens:** Forgetting to conditionally render the tab based on admin status.
**How to avoid:** Pass `reviewQueueContent` as `undefined` for non-admin; ArticleTabs only renders the 5th tab when the prop is provided.
**Warning signs:** Non-admin users see an empty tab or crash.

### Pitfall 5: Sidebar Props Cascade Complexity
**What goes wrong:** The review counts Map needs to flow through multiple component layers (layout -> AppSidebar -> SortableSidebar/CategoryTree -> SortableItem/CategoryNode).
**Why it happens:** Deep component hierarchy for the sidebar.
**How to avoid:** Accept it as necessary -- pass `reviewCounts: Map<string, number>` through the chain. The alternative (React Context) is overkill for a simple Map and adds complexity.
**Warning signs:** Missing prop at one level causes badges to silently not render.

## Code Examples

### Article Page: Adding Review Count and Comment Count (Server-Side)
```typescript
// In src/app/(wiki)/wiki/[articleSlug]/page.tsx
// Add to the existing Promise.all:
const [bookmarked, annotationCount, fileLinks, dbTables, commentCount] = await Promise.all([
  session?.user?.id
    ? isArticleBookmarked(session.user.id, article.id)
    : Promise.resolve(false),
  getActiveAnnotationCount(article.id),
  getArticleFileLinks(article.id),
  getArticleDbTables(article.id),
  getArticleCommentCount(article.id),
]);

// Compute review count for tab label
const reviewCount = (article.needsReview ? 1 : 0) + annotationCount;
const isAdmin = session?.user?.role === "admin";
```

### ArticleTabs: Extended Interface
```typescript
// In src/components/wiki/article-tabs.tsx
interface ArticleTabsProps {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
  commentsContent: React.ReactNode;
  historyContent: React.ReactNode;
  reviewQueueContent?: React.ReactNode;
  commentCount?: number;
  reviewCount?: number;
}

export function ArticleTabs({
  articleContent,
  technicalView,
  commentsContent,
  historyContent,
  reviewQueueContent,
  commentCount,
  reviewCount,
}: ArticleTabsProps) {
  return (
    <Tabs defaultValue="article">
      <TabsList>
        <TabsTrigger value="article">
          <FileText className="size-4" />
          Article
        </TabsTrigger>
        <TabsTrigger value="technical">
          <Code className="size-4" />
          Technical View
        </TabsTrigger>
        <TabsTrigger value="comments">
          <MessageSquare className="size-4" />
          Comments{commentCount ? ` (${commentCount})` : ""}
        </TabsTrigger>
        {reviewQueueContent && (
          <TabsTrigger value="review">
            <ClipboardList className="size-4" />
            Review Queue{reviewCount ? ` (${reviewCount})` : ""}
          </TabsTrigger>
        )}
        <TabsTrigger value="history">
          <History className="size-4" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="article">{articleContent}</TabsContent>
      <TabsContent value="technical">{technicalView}</TabsContent>
      <TabsContent value="comments">{commentsContent}</TabsContent>
      {reviewQueueContent && (
        <TabsContent value="review">{reviewQueueContent}</TabsContent>
      )}
      <TabsContent value="history">{historyContent}</TabsContent>
    </Tabs>
  );
}
```

### Sidebar Badge: Subtle Count Indicator
```typescript
// In SortableItem or CategoryTree article items
// Recommendation for badge styling: muted, small, right-aligned
{isAdmin && reviewCount > 0 && (
  <span className="ml-auto shrink-0 flex items-center justify-center size-5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
    {reviewCount}
  </span>
)}
```

### Batch Query: Review Counts for Sidebar
```typescript
// In queries.ts
export async function getReviewCountsByArticle(): Promise<Map<string, number>> {
  const db = getDb();
  const results = await db.execute(sql`
    SELECT
      a.id AS "articleId",
      (CASE WHEN a.needs_review THEN 1 ELSE 0 END +
       COALESCE(ann.count, 0))::int AS "reviewCount"
    FROM articles a
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS count
      FROM ai_review_annotations
      WHERE is_dismissed = false
      GROUP BY article_id
    ) ann ON a.id = ann.article_id
    WHERE a.needs_review = true OR ann.count > 0
  `);
  const map = new Map<string, number>();
  for (const row of results.rows as any[]) {
    map.set(row.articleId, Number(row.reviewCount));
  }
  return map;
}
```

### Article Review Queue Tab Content Component
```typescript
// New component: src/components/wiki/article-review-queue.tsx
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, OctagonAlert, ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ArticleReviewQueueProps {
  articleId: string;
  needsReview: boolean;
}

// Fetches annotations via existing API, displays them alongside needsReview status
// Similar to AnnotationBanner but as a full tab view with dismiss capability
export function ArticleReviewQueue({ articleId, needsReview }: ArticleReviewQueueProps) {
  // ... fetch annotations, render cards with severity icons, dismiss buttons
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Review queue only at admin level | Article-level + admin-level review queue | Phase 11 | Admins can review items in-context on each article |
| No sidebar review indicators | Sidebar badges for admin | Phase 11 | Quick visual scan of which articles need attention |
| Comments tab shows no count | Comments tab shows count | Phase 11 | Users immediately see discussion activity |

## Open Questions

1. **Radix Tabs conditional rendering**
   - What we know: The shadcn/ui Tabs component wraps Radix Tabs primitive. Conditionally rendering a TabsTrigger and TabsContent pair should work as long as the `value` props match.
   - What's unclear: Whether conditionally rendered Trigger/Content pairs cause any layout or ARIA issues with Radix Tabs.
   - Recommendation: Test during implementation. If issues arise, render the tab always but hide via CSS (`className={cn(!isAdmin && "hidden")}`) as a fallback. LOW risk -- Radix Tabs handles dynamic children well per general React/Radix patterns.

2. **Review count definition: what counts as "1 item"?**
   - What we know: The admin review queue shows articles, not individual annotations. Each article card shows a "Needs Review" badge and/or an "N Annotations" badge.
   - What's unclear: For the sidebar badge and tab count, should it be "number of articles needing review" (always 0 or 1 for a single article) or "total items" (1 for needsReview + N for annotations)?
   - Recommendation: Use total items: `(needsReview ? 1 : 0) + annotationCount`. This gives a more useful count for the sidebar badge ("3" means "3 things to look at" rather than just "this article needs review").

## Sources

### Primary (HIGH confidence)
- Codebase inspection of `src/app/(admin)/admin/review-queue/` -- existing ReviewQueueList component and page
- Codebase inspection of `src/lib/wiki/queries.ts` -- getReviewQueueItems(), getActiveAnnotationCount(), getArticleComments()
- Codebase inspection of `src/components/wiki/article-tabs.tsx` -- current 4-tab implementation
- Codebase inspection of `src/components/wiki/sortable-sidebar.tsx` and `sortable-item.tsx` -- admin sidebar rendering
- Codebase inspection of `src/components/wiki/category-tree.tsx` -- non-admin sidebar rendering
- Codebase inspection of `src/app/(wiki)/layout.tsx` -- wiki layout where sidebar data is fetched
- Codebase inspection of `src/app/(wiki)/wiki/[articleSlug]/page.tsx` -- article page server component
- Codebase inspection of `src/lib/db/schema.ts` -- articles.needsReview, aiReviewAnnotations, comments tables
- Codebase inspection of `src/components/wiki/comments-section.tsx` -- existing comment count logic

### Secondary (MEDIUM confidence)
- shadcn/ui Tabs component (`src/components/ui/tabs.tsx`) -- conditional rendering patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything already installed and verified in codebase
- Architecture: HIGH -- all patterns derived from direct codebase inspection, straightforward wiring
- Pitfalls: HIGH -- based on concrete analysis of existing data flow and component hierarchy

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- internal feature wiring, no external dependency risk)
