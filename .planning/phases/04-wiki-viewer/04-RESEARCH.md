# Phase 4: Wiki Viewer - Research

**Researched:** 2026-02-13
**Domain:** Next.js App Router wiki UI -- navigation, Markdown rendering, full-text search, responsive layout
**Confidence:** HIGH

## Summary

Phase 4 transforms UltraWiki from an admin-only backend into a user-facing wiki with browsing, reading, and search capabilities. The core technical challenges are: (1) rendering AI-generated Markdown with syntax-highlighted code blocks, (2) building a collapsible category/article tree sidebar, (3) implementing Postgres full-text search with debounced as-you-type results, and (4) wiring the admin "Regenerate Article" button to the existing AI pipeline.

The existing codebase already has the `search_vector` tsvector column with GIN index deployed on the `articles` table (generated from `title || content_markdown`). The schema supports hierarchical categories (`parent_category_id`) and hierarchical articles (`parent_article_id`). Content is stored as Markdown (`content_markdown`) with `content_json` intentionally null (BlockNote conversion deferred to client-side editor in Phase 5). The `(wiki)` route group layout already exists with a top nav bar and `UserMenu` -- this needs to be reworked into a sidebar-based layout.

The recommended stack leverages libraries already in the project where possible (shadcn/ui, Radix, Tailwind, Drizzle, lucide-react) and adds the minimum new dependencies: `react-markdown` + `remark-gfm` for GFM Markdown rendering, `shiki` with `@shikijs/rehype` for VS Code-quality syntax highlighting in server components, and `use-debounce` for search-as-you-type. The shadcn `sidebar` component provides a composable, themeable, collapsible sidebar with built-in mobile sheet behavior (VIEW-10). The shadcn `breadcrumb` component handles VIEW-02.

**Primary recommendation:** Use shadcn's sidebar component for the app shell, react-markdown with @shikijs/rehype for server-side Markdown rendering, Postgres `websearch_to_tsquery` + `ts_rank` + `ts_headline` via Drizzle raw SQL for search, and URL-based search params with `use-debounce` for search-as-you-type.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.x | Render Markdown to React components | Industry standard for React Markdown rendering; safe by default (no dangerouslySetInnerHTML for content); 100% CommonMark compliant; supports rehype/remark plugins |
| remark-gfm | ^4.x | GitHub Flavored Markdown (tables, task lists, strikethrough) | AI-generated content uses GFM features; standard companion to react-markdown |
| shiki | ^3.22 | Syntax highlighting engine (VS Code grammar) | Editor-grade accuracy; lazy-loads languages; zero client-side JS when used in server components |
| @shikijs/rehype | ^3.22 | Rehype plugin bridging shiki into unified pipeline | Official shiki integration for react-markdown's rehypePlugins; runs at render time in RSC |
| use-debounce | ^10.1 | Debounced search input | Tiny, well-maintained; Next.js official tutorial uses this exact library |
| shadcn sidebar | (radix) | Collapsible sidebar with mobile sheet | Already in project's design system; composable with Collapsible for tree navigation; built-in responsive mobile behavior |
| shadcn breadcrumb | (radix) | Breadcrumb navigation | Already in project's design system; works with Next.js Link via asChild |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45 | Database queries with raw SQL for tsvector | All data fetching; use `sql` template for FTS queries |
| lucide-react | ^0.564 | Icons for sidebar, tabs, badges, search | ChevronRight, Search, Clock, User, Bot, RefreshCw, etc. |
| radix-ui | ^1.4 | Tabs, Collapsible, ScrollArea primitives | Tab system (VIEW-04), collapsible tree nodes, scrollable sidebar |
| sonner | ^2.0 | Toast notifications | Regenerate success/failure feedback |
| next-themes | ^0.4 | Dark mode support | Already configured; shiki dual themes (light/dark) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | unified pipeline directly | More control but more boilerplate; react-markdown wraps unified and is simpler |
| shiki/@shikijs/rehype | rehype-pretty-code | rehype-pretty-code wraps shiki with extra features (line highlighting, titles) but adds complexity; @shikijs/rehype is sufficient and more direct |
| shiki | highlight.js/prism | Fewer languages, less accurate, client-side JS required; shiki is zero-JS in RSC |
| use-debounce | hand-rolled setTimeout | Easy to get wrong (cleanup, stale closures); use-debounce handles edge cases |
| shadcn sidebar | custom sidebar | Would hand-roll responsive collapse, keyboard shortcut, mobile sheet -- all included free |

**Installation:**
```bash
npm install react-markdown remark-gfm shiki @shikijs/rehype use-debounce
npx shadcn@latest add sidebar breadcrumb collapsible tooltip skeleton sheet
```

Note: `shadcn add sidebar` also installs the sheet component (for mobile), tooltip, and other peer dependencies. The `collapsible` component is needed for tree nodes. `skeleton` is useful for loading states on search results and article content.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(wiki)/
│   ├── layout.tsx                    # Reworked: SidebarProvider + AppSidebar + main content area
│   ├── page.tsx                      # Home dashboard (VIEW-09)
│   ├── search/
│   │   └── page.tsx                  # Full search results page (optional, search also in header)
│   └── [categorySlug]/
│       └── [articleSlug]/
│           └── page.tsx              # Article view (VIEW-03, VIEW-04, VIEW-05, VIEW-08)
├── components/
│   ├── wiki/
│   │   ├── app-sidebar.tsx           # Sidebar with category tree (VIEW-01, VIEW-10)
│   │   ├── category-tree.tsx         # Recursive collapsible category/article tree
│   │   ├── article-breadcrumb.tsx    # Dynamic breadcrumb from category hierarchy (VIEW-02)
│   │   ├── article-content.tsx       # Markdown renderer with TOC extraction (VIEW-03, VIEW-08)
│   │   ├── article-tabs.tsx          # Tab system: Article | Technical | Comments | History (VIEW-04)
│   │   ├── article-metadata.tsx      # Metadata sidebar panel (VIEW-05)
│   │   ├── table-of-contents.tsx     # Sticky TOC from headings (VIEW-08)
│   │   ├── search-input.tsx          # Debounced search with dropdown results (VIEW-06, VIEW-07)
│   │   ├── search-results.tsx        # Search result list with highlighting
│   │   ├── home-dashboard.tsx        # Recent updates + search bar (VIEW-09)
│   │   └── regenerate-button.tsx     # Admin-only regenerate action
│   └── ui/
│       ├── sidebar.tsx               # shadcn sidebar (added via CLI)
│       ├── breadcrumb.tsx            # shadcn breadcrumb (added via CLI)
│       ├── collapsible.tsx           # shadcn collapsible (added via CLI)
│       ├── skeleton.tsx              # shadcn skeleton (added via CLI)
│       └── sheet.tsx                 # shadcn sheet (added via CLI, peer of sidebar)
├── lib/
│   ├── wiki/
│   │   ├── queries.ts               # Data access: categories, articles, search
│   │   └── actions.ts               # Server actions: regenerate article
│   └── search/
│       └── index.ts                  # Full-text search query builder
```

### Pattern 1: Sidebar-Based Wiki Layout (VIEW-01, VIEW-10)
**What:** Replace the current `(wiki)/layout.tsx` with a `SidebarProvider`-wrapped layout that includes a collapsible sidebar with the category tree.
**When to use:** This is the primary layout for all wiki pages.
**Example:**
```tsx
// Source: shadcn sidebar docs + project conventions
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/wiki/app-sidebar";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Fetch categories + articles for sidebar (server component)
  const categoryTree = await getCategoryTreeWithArticles();

  return (
    <SidebarProvider>
      <AppSidebar categories={categoryTree} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {/* Breadcrumb + Search go here */}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Pattern 2: Recursive Category Tree (VIEW-01)
**What:** A recursive component rendering categories and their articles as collapsible tree nodes using shadcn's Collapsible + SidebarMenuSub.
**When to use:** Inside the AppSidebar for the navigation tree.
**Example:**
```tsx
// Source: shadcn sidebar docs (SidebarMenuSub pattern)
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { ChevronRight, FileText, FolderOpen } from "lucide-react";

function CategoryNode({ category }: { category: CategoryWithArticles }) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <FolderOpen className="h-4 w-4" />
            <span>{category.name}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {category.articles.map((article) => (
              <SidebarMenuSubItem key={article.slug}>
                <SidebarMenuSubButton asChild>
                  <Link href={`/${category.slug}/${article.slug}`}>
                    <FileText className="h-4 w-4" />
                    <span>{article.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
            {category.children?.map((child) => (
              <CategoryNode key={child.id} category={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
```

### Pattern 3: Server-Side Markdown Rendering with Shiki (VIEW-03, VIEW-08)
**What:** Use `react-markdown` with `@shikijs/rehype` and `remark-gfm` in a server component. Since `@shikijs/rehype` is async, use react-markdown's `MarkdownAsync` export. Extract headings for TOC during a separate parse pass.
**When to use:** Article content rendering.
**Example:**
```tsx
// Source: react-markdown docs + @shikijs/rehype docs
import MarkdownAsync from "react-markdown"; // v10 supports async plugins in RSC
import remarkGfm from "remark-gfm";
import rehypeShiki from "@shikijs/rehype";

interface ArticleContentProps {
  markdown: string;
}

export async function ArticleContent({ markdown }: ArticleContentProps) {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeShiki, {
            themes: { light: "github-light", dark: "github-dark" },
          }],
        ]}
      >
        {markdown}
      </MarkdownAsync>
    </article>
  );
}
```

### Pattern 4: Full-Text Search with Drizzle Raw SQL (VIEW-06)
**What:** Query the existing `search_vector` GIN index using `websearch_to_tsquery` (natural language query syntax), rank with `ts_rank`, and highlight with `ts_headline`.
**When to use:** Search API route or server action.
**Example:**
```tsx
// Source: Drizzle ORM FTS guide + PostgreSQL docs
import { sql, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articles, categories } from "@/lib/db/schema";

export async function searchArticles(query: string, limit = 20) {
  const db = getDb();

  const results = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      categoryId: articles.categoryId,
      updatedAt: articles.updatedAt,
      rank: sql<number>`ts_rank(${articles.searchVector}, websearch_to_tsquery('english', ${query}))`,
      headline: sql<string>`ts_headline('english', ${articles.contentMarkdown}, websearch_to_tsquery('english', ${query}), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`,
    })
    .from(articles)
    .where(
      sql`${articles.searchVector} @@ websearch_to_tsquery('english', ${query})`
    )
    .orderBy(desc(sql`ts_rank(${articles.searchVector}, websearch_to_tsquery('english', ${query}))`))
    .limit(limit);

  return results;
}
```

### Pattern 5: Debounced Search with URL Params (VIEW-07)
**What:** Use `use-debounce`'s `useDebouncedCallback` to update URL search params. The server component re-fetches on param change. This is the Next.js-recommended pattern (from their official tutorial).
**When to use:** Search input component.
**Example:**
```tsx
// Source: Next.js official search tutorial + use-debounce docs
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    router.push(`/search?${params.toString()}`);
  }, 300);

  return (
    <input
      type="search"
      placeholder="Search articles..."
      defaultValue={searchParams.get("q") ?? ""}
      onChange={(e) => handleSearch(e.target.value)}
    />
  );
}
```

### Pattern 6: Regenerate Article Server Action
**What:** Admin-only server action that re-fetches linked source files and re-runs the AI pipeline for a single article. Reuses existing `fetchFileContents`, `generateArticle`, `mergeArticleContent`, and version tracking code.
**When to use:** The "Regenerate Article" button on the article page.
**Example:**
```tsx
// Source: existing pipeline.ts patterns
"use server";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function regenerateArticle(articleId: string) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Unauthorized");

  // 1. Load article + linked files from article_file_links
  // 2. Fetch file contents from GitHub via fetchFileContents
  // 3. Re-run generateArticle with current style prompt
  // 4. If hasHumanEdits: run mergeArticleContent (3-way merge)
  //    Else: direct overwrite
  // 5. Create version record
  // 6. Update article row
  // 7. revalidatePath to refresh the page
  revalidatePath(`/[categorySlug]/[articleSlug]`);
}
```

### Anti-Patterns to Avoid
- **Client-side Markdown rendering with syntax highlighting:** Ship shiki's WASM + grammars to the client. Instead, use RSC with @shikijs/rehype -- zero client JS for highlighting.
- **Fetching search results in a server action:** Server actions use POST and are designed for mutations. Use a server component with URL search params, or a GET API route.
- **Storing search state in React state only:** Loses search on refresh/share. Always use URL params for search queries.
- **Building a custom sidebar from scratch:** shadcn sidebar handles responsive collapse, mobile sheet, keyboard shortcut (Cmd+B), and accessibility out of the box.
- **Using dangerouslySetInnerHTML for Markdown:** react-markdown sanitizes by default. Only use dangerouslySetInnerHTML for ts_headline output (already sanitized by Postgres, limited to `<mark>` tags).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sidebar with mobile | Custom CSS sidebar with media queries | shadcn `sidebar` component | Handles offcanvas mode, icon mode, mobile sheet, keyboard shortcut, state persistence via cookie |
| Markdown to React | Custom parser or dangerouslySetInnerHTML | `react-markdown` + `remark-gfm` | Safe by default, extensible via plugins, handles edge cases in Markdown spec |
| Code syntax highlighting | regex-based highlighter or client-side Prism | `shiki` via `@shikijs/rehype` | VS Code accuracy, 200+ languages, zero client JS in RSC, dual theme support |
| Full-text search | ILIKE queries or client-side filtering | Postgres `tsvector` + `ts_rank` + `ts_headline` | Already indexed (GIN), handles stemming/stopwords, relevance ranking, snippet highlighting |
| Search debouncing | setTimeout with cleanup | `use-debounce` | Handles stale closures, maxWait, leading/trailing options, isPending |
| Breadcrumb from hierarchy | Manual path parsing | shadcn `breadcrumb` + data-driven from category chain | Accessible, styled consistently, supports collapse with ellipsis |
| TOC from headings | Manual regex on Markdown | Parse headings from rehype AST or `remark-toc` | Handles nested headings, ID generation, anchor links properly |

**Key insight:** This phase is primarily a composition phase -- it renders existing data (articles, categories) using established UI patterns. The complexity is in wiring, not inventing. Use battle-tested components and let the framework do the heavy lifting.

## Common Pitfalls

### Pitfall 1: @shikijs/rehype is Async -- react-markdown Default is Sync
**What goes wrong:** Importing `rehypeShiki` from `@shikijs/rehype` and passing it to react-markdown's `rehypePlugins` may fail silently or produce unhighlighted output because the plugin is async (lazy-loads themes/languages).
**Why it happens:** react-markdown's default `Markdown` component is synchronous. Async rehype plugins require the `MarkdownAsync` export or pre-rendering via unified pipeline.
**How to avoid:** In server components (RSC), use the async-capable export. react-markdown v10 exports `MarkdownAsync` for this purpose. Alternatively, use the unified pipeline directly (`unified().use(remarkParse).use(remarkRehype).use(rehypeShiki, opts).use(rehypeStringify).process(md)`).
**Warning signs:** Code blocks render as plain `<pre><code>` with no syntax highlighting classes or inline styles.

### Pitfall 2: Shiki Dual Theme Requires CSS Data Attribute Strategy
**What goes wrong:** Light and dark themes render as separate sets of inline styles; switching themes without proper CSS setup shows both or neither.
**Why it happens:** Shiki's dual theme mode generates `data-theme` attributes on spans. You need CSS that hides/shows the correct set based on `.dark` class.
**How to avoid:** Use shiki's `themes` config (not `theme`). Add CSS: `.dark .shiki, .dark .shiki span { color: var(--shiki-dark) !important; background-color: var(--shiki-dark-bg) !important; }`. The project already uses `next-themes` with class-based dark mode.
**Warning signs:** Code blocks show wrong colors or double-rendered text after theme toggle.

### Pitfall 3: Generated tsvector Column Cannot Use websearch_to_tsquery Prefix Matching
**What goes wrong:** Searching "deploy" matches, but typing "depl" (partial word) returns zero results.
**Why it happens:** `websearch_to_tsquery` and `to_tsquery` match against stemmed lexemes, not prefixes. "depl" is not a valid English stem.
**How to avoid:** For prefix/partial matching, append `:*` to the last term: `to_tsquery('english', 'depl:*')`. Or use a hybrid approach: tsvector for final search, ILIKE for the as-you-type preview. Since we debounce at 300ms, users typically type enough for valid stems.
**Warning signs:** Short queries return no results; users complain search "doesn't work" until they finish typing.

### Pitfall 4: SidebarProvider Must Wrap the Layout, Not Individual Pages
**What goes wrong:** Sidebar state resets on navigation, or sidebar disappears on certain pages.
**Why it happens:** SidebarProvider placed inside a page component instead of the layout.
**How to avoid:** Place `<SidebarProvider>` in `(wiki)/layout.tsx` so it wraps all wiki pages. The sidebar data is fetched in the layout (server component).
**Warning signs:** Sidebar collapses/expands unexpectedly during navigation.

### Pitfall 5: ts_headline Returns Raw HTML -- XSS Risk
**What goes wrong:** Rendering `ts_headline` output with `dangerouslySetInnerHTML` exposes XSS if article content contains malicious HTML.
**Why it happens:** `ts_headline` returns HTML tags (`<mark>`, `<b>`) in a raw string. The default `StartSel`/`StopSel` are `<b>`/`</b>`.
**How to avoid:** Use custom markers: `StartSel=<mark>, StopSel=</mark>`. Then either: (a) sanitize with a simple allowlist (only `<mark>` tags), or (b) parse the headline and replace `<mark>` with a React component. Since article content is AI-generated (trusted source), the risk is LOW but defense-in-depth is good practice.
**Warning signs:** Search results display HTML tags as literal text, or worse, script injection.

### Pitfall 6: The (wiki) Layout Needs Reworking -- Not Additive
**What goes wrong:** Developer tries to add sidebar alongside the existing top nav, producing a broken layout.
**Why it happens:** The current `(wiki)/layout.tsx` has a simple `<nav>` + `<main>` structure with `max-w-7xl`. The new layout needs `SidebarProvider` > `Sidebar` + `SidebarInset` which is a fundamentally different layout model.
**How to avoid:** Plan the layout rework as the first task. The top nav content (logo, user menu) moves into the sidebar header/footer and the `SidebarInset` header. The `max-w-7xl` constraint may need adjustment or removal for the sidebar layout.
**Warning signs:** Sidebar overlaps content, double scrollbars, inconsistent width.

### Pitfall 7: No Bookmarks Table in Schema
**What goes wrong:** Attempting to implement VIEW-09 "bookmarked articles" on the home dashboard fails because there is no `bookmarks` or `user_article_bookmarks` table.
**Why it happens:** CONT-04 (article bookmarks) is listed as a v2 requirement, but VIEW-09 references "bookmarked articles" on the home page.
**How to avoid:** Add a simple `user_bookmarks` junction table (user_id, article_id) in this phase via a new migration, OR scope VIEW-09 to show only "recent updates + search bar" without bookmarks and defer bookmarks to a later phase. The planner must make this decision.
**Warning signs:** VIEW-09 requirement cannot be fully met without schema changes.

## Code Examples

Verified patterns from official sources:

### TOC Extraction from Markdown Headings
```tsx
// Source: Standard approach - parse headings from markdown string
// Run this ONCE per article render, not inside the Markdown component

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function extractToc(markdown: string): TocEntry[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    entries.push({ id, text, level });
  }

  return entries;
}
```

### Drizzle Query: Category Tree with Articles for Sidebar
```tsx
// Source: Drizzle ORM conventions + existing project patterns
import { getDb } from "@/lib/db";
import { categories, articles } from "@/lib/db/schema";
import { eq, asc, isNull } from "drizzle-orm";

interface CategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentCategoryId: string | null;
  articles: { id: string; title: string; slug: string }[];
  children: CategoryWithArticles[];
}

export async function getCategoryTreeWithArticles(): Promise<CategoryWithArticles[]> {
  const db = getDb();

  const [allCategories, allArticles] = await Promise.all([
    db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      parentCategoryId: categories.parentCategoryId,
    }).from(categories).orderBy(asc(categories.sortOrder)),

    db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      categoryId: articles.categoryId,
      sortOrder: articles.sortOrder,
    }).from(articles).orderBy(asc(articles.sortOrder)),
  ]);

  // Build tree from flat list
  const categoryMap = new Map<string, CategoryWithArticles>();
  for (const cat of allCategories) {
    categoryMap.set(cat.id, { ...cat, articles: [], children: [] });
  }

  // Attach articles to their categories
  for (const article of allArticles) {
    if (article.categoryId && categoryMap.has(article.categoryId)) {
      categoryMap.get(article.categoryId)!.articles.push({
        id: article.id,
        title: article.title,
        slug: article.slug,
      });
    }
  }

  // Build parent-child relationships
  const roots: CategoryWithArticles[] = [];
  for (const cat of categoryMap.values()) {
    if (cat.parentCategoryId && categoryMap.has(cat.parentCategoryId)) {
      categoryMap.get(cat.parentCategoryId)!.children.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}
```

### Breadcrumb from Article's Category Chain
```tsx
// Source: shadcn breadcrumb docs + category hierarchy
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

interface BreadcrumbSegment {
  label: string;
  href: string;
}

export function ArticleBreadcrumb({
  segments,
  currentTitle,
}: {
  segments: BreadcrumbSegment[];
  currentTitle: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg) => (
          <BreadcrumbItem key={seg.href}>
            <BreadcrumbSeparator />
            <BreadcrumbLink asChild>
              <Link href={seg.href}>{seg.label}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentTitle}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

### Shiki Dual Theme CSS
```css
/* Source: shiki docs - CSS Variables theme strategy */
/* Add to globals.css or a dedicated code-theme.css */

/* Shiki dual theme: use CSS variables approach */
.shiki,
.shiki span {
  color: var(--shiki-light) !important;
  background-color: var(--shiki-light-bg) !important;
}

.dark .shiki,
.dark .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}

/* Code block container styling */
article pre {
  @apply overflow-x-auto rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800;
}

article pre code {
  @apply bg-transparent;
}

/* Inline code styling (not highlighted by shiki) */
article :not(pre) > code {
  @apply rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800;
}
```

### Tab System for Article Page (VIEW-04)
```tsx
// Source: shadcn tabs (already installed) + project conventions
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Code, MessageSquare, History } from "lucide-react";

export function ArticleTabs({
  articleContent,
  technicalView,
}: {
  articleContent: React.ReactNode;
  technicalView: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="article">
      <TabsList>
        <TabsTrigger value="article">
          <FileText className="mr-2 h-4 w-4" />
          Article
        </TabsTrigger>
        <TabsTrigger value="technical">
          <Code className="mr-2 h-4 w-4" />
          Technical View
        </TabsTrigger>
        <TabsTrigger value="comments" disabled>
          <MessageSquare className="mr-2 h-4 w-4" />
          Comments
        </TabsTrigger>
        <TabsTrigger value="history" disabled>
          <History className="mr-2 h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="article">{articleContent}</TabsContent>
      <TabsContent value="technical">{technicalView}</TabsContent>
      <TabsContent value="comments">
        <p className="text-sm text-muted-foreground">Comments will be available in Phase 6.</p>
      </TabsContent>
      <TabsContent value="history">
        <p className="text-sm text-muted-foreground">Version history will be available in Phase 5.</p>
      </TabsContent>
    </Tabs>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| highlight.js / Prism.js (client-side) | shiki (server-side in RSC) | 2024 (shiki v1) | Zero client JS for code highlighting; VS Code grammar accuracy |
| Custom CSS sidebars | shadcn sidebar component | 2024 (shadcn sidebar release) | Composable, accessible, responsive out of the box |
| Client-side search state | URL search params + server components | Next.js 13+ App Router | Shareable URLs, server-side rendering, no hydration mismatch |
| `to_tsquery` for user search | `websearch_to_tsquery` | PostgreSQL 11+ | Natural language input; no need to teach users boolean syntax |
| react-markdown sync only | react-markdown v10 with MarkdownAsync | 2024 (react-markdown v10) | Supports async rehype plugins in server components |

**Deprecated/outdated:**
- `react-syntax-highlighter`: Wraps Prism/highlight.js, ships large client bundle. Replaced by shiki in RSC contexts.
- `remark-highlight.js`: Deprecated in favor of shiki-based rehype plugins.
- `getTableColumns` in Drizzle < 1.0: Use `getColumns` in Drizzle 1.0+. This project uses 0.45 so must use `getTableColumns` or manual column selection.

## Open Questions

1. **Bookmarks on Home Dashboard (VIEW-09)**
   - What we know: VIEW-09 requires "bookmarked articles" on the home page. No `user_bookmarks` table exists. CONT-04 (bookmarks) is listed as v2.
   - What's unclear: Should we add a bookmarks table now, or scope VIEW-09 to exclude bookmarks?
   - Recommendation: Add a minimal `user_bookmarks` table (`user_id`, `article_id`, `created_at`) and a simple star button. It is a simple junction table (5 minutes of schema work, one migration) and completes VIEW-09. Deferring makes the home page feel incomplete.

2. **Article URL Structure**
   - What we know: Articles have `slug` (unique) and belong to categories with `slug`. The route could be `/[articleSlug]` or `/[categorySlug]/[articleSlug]`.
   - What's unclear: Should URLs include the category prefix? `/getting-started` vs `/guides/getting-started`.
   - Recommendation: Use `/wiki/[articleSlug]` (flat, since article slugs are globally unique). Category is shown in breadcrumb and sidebar, not URL. This avoids URL breakage if article is recategorized. The `/wiki` prefix distinguishes from other routes like `/profile`, `/admin`.

3. **Technical View Rendering**
   - What we know: `technical_view_markdown` is stored as Markdown. VIEW-04 requires a "Technical View" tab.
   - What's unclear: Should it use the same Markdown renderer as the article content?
   - Recommendation: Yes, reuse the same `ArticleContent` component for technical view markdown. This gives syntax highlighting for file paths and code references.

4. **Prose Typography Styling**
   - What we know: Tailwind CSS Typography plugin (`@tailwindcss/typography`) provides `prose` classes for Markdown content. Not currently in the project dependencies.
   - What's unclear: Is it already included via Tailwind v4? Or does it need to be added?
   - Recommendation: Check if `@tailwindcss/typography` is bundled in Tailwind v4. If not, add it. The `prose` class is essential for readable Markdown content (proper heading sizes, paragraph spacing, list styles, code blocks, tables).

## Sources

### Primary (HIGH confidence)
- shadcn/ui sidebar docs: https://ui.shadcn.com/docs/components/radix/sidebar - Installation, API, composable sub-components, collapsible tree pattern
- shadcn/ui breadcrumb docs: https://ui.shadcn.com/docs/components/radix/breadcrumb - Component API and Next.js Link integration
- Drizzle ORM full-text search guide: https://orm.drizzle.team/docs/guides/postgresql-full-text-search - ts_rank, websearch_to_tsquery, setweight patterns
- Drizzle ORM FTS with generated columns: https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns - tsvector column, GIN index
- @shikijs/rehype docs: https://shiki.style/packages/rehype - Rehype plugin for shiki, dual theme config
- Shiki Next.js guide: https://shiki.style/packages/next - Server component setup, lazy loading
- PostgreSQL text search docs: https://www.postgresql.org/docs/current/textsearch-controls.html - ts_headline, ts_rank, websearch_to_tsquery
- Next.js search tutorial: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination - URL params + use-debounce pattern

### Secondary (MEDIUM confidence)
- react-markdown GitHub: https://github.com/remarkjs/react-markdown - v10 features, MarkdownAsync export
- use-debounce npm: https://www.npmjs.com/package/use-debounce - v10.1.0, useDebouncedCallback API
- shiki npm: https://www.npmjs.com/package/shiki - v3.22.0 current

### Tertiary (LOW confidence)
- react-shiki (alternative approach): https://github.com/AVGVSTVS96/react-shiki - Client-side alternative, not recommended for this project since we use RSC
- rehype-pretty-code: https://rehype-pretty.pages.dev/ - Alternative to @shikijs/rehype with extra features (line numbers, titles)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm; project already uses shadcn/radix/tailwind/drizzle
- Architecture: HIGH - Patterns follow shadcn docs and Next.js App Router conventions; verified against existing codebase structure
- Pitfalls: HIGH - Known issues from official docs (async plugins, dual themes, tsvector prefix matching) and codebase analysis (missing bookmarks table, layout rework needed)
- Search implementation: HIGH - tsvector column + GIN index already deployed in migration; Drizzle raw SQL patterns verified in official guide

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days -- stable libraries, no fast-moving APIs)
