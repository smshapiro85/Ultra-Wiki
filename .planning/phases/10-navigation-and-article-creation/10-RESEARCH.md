# Phase 10: Navigation and Article Creation - Research

**Researched:** 2026-02-14
**Domain:** Nested sidebar navigation, drag-and-drop tree, article CRUD, AI pipeline subcategory awareness
**Confidence:** HIGH

## Summary

Phase 10 extends the wiki's category system to support 2-level nesting (Category > Subcategory > Articles), adds drag-and-drop reorganization of the entire sidebar tree, enables manual article creation via a modal, redesigns the header search bar, adds context menus to sidebar items, and updates the AI pipeline to understand subcategories.

The existing database schema already has `parentCategoryId` on the categories table, and the sidebar tree (`CategoryTree` component) already recursively renders `children` -- meaning subcategory support is structurally half-built. The primary work is: (1) enforcing the 2-level max depth constraint, (2) building drag-and-drop with `@dnd-kit`, (3) creating the article creation modal with cascading dropdowns, (4) adding hover context menus to sidebar items, (5) updating the header layout, and (6) updating AI pipeline prompts and `category_suggestion` handling.

**Primary recommendation:** Use `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 for drag-and-drop (stable, React 19 compatible). Implement the tree DnD using the "flatten-then-reorder" pattern from dnd-kit's official sortable tree example. Use shadcn/ui `DropdownMenu` (already installed) for hover context menus since the user specified hover-triggered menus, not right-click context menus.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Nested Categories:** Maximum 2 levels (Category > Subcategory > Articles). No deeper. AI pipeline CAN create subcategories. Mixed content (direct articles + subcategories) allowed. Empty categories/subcategories shown. Admin-only create/rename/delete. Deletion blocked if contains articles.
- **Drag-and-Drop:** Admin-only, always active (no edit mode toggle), drag handles on hover, auto-save on drop, everything draggable (categories, subcategories, articles), full reparenting, blue drop indicator line.
- **Article Creation:** Admin-only, header button (primary styled, right of search bar, hidden from non-admins), modal with title + category dropdown + dynamic subcategory dropdown, inline "+ New Category" and "+ New Subcategory" in dropdowns, navigate to editor after creation.
- **Header & Search:** Center-aligned search bar, roughly 2x wider than current. Create button to right.
- **Sidebar Context Menus:** Hover '+' icon on categories -> Add Subcategory, Add Article, Rename, Delete. Same hover pattern on subcategories -> Add Article, Rename, Delete. Articles -> Rename, Delete, Move to... (category picker). All admin-only.
- **AI Pipeline Updates:** Prompts updated for subcategory concept, analysis prompt rules for when to create subcategories, code handles parentCategoryId, category anchoring extends to subcategories.

### Claude's Discretion
None specified -- all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop framework | De facto React DnD standard, lightweight (10kb), no HTML5 DnD API dependency, performant CSS transforms |
| @dnd-kit/sortable | 10.0.0 | Sortable preset for DnD | Thin layer on core, provides useSortable hook, SortableContext |
| @dnd-kit/utilities | 3.2.2 | CSS utilities for transforms | Provides CSS.Transform.toString() helper |

### Already in Project (reuse)
| Library | Purpose | How Used |
|---------|---------|----------|
| radix-ui (monorepo) | Dialog, DropdownMenu, Collapsible primitives | Already installed; Dialog for create modal, DropdownMenu for context menus |
| lucide-react | Icons (Plus, GripVertical, Pencil, Trash2, FolderPlus, FilePlus, Move) | Sidebar icons, drag handles, context menu icons |
| drizzle-orm 0.45 | Database ORM | Category/article CRUD, sortOrder updates |
| sonner | Toast notifications | Feedback on DnD saves, article creation, rename, delete |

### New UI Components Needed (shadcn/ui)
| Component | Install Command | Purpose |
|-----------|-----------------|---------|
| Select | `npx shadcn@latest add select` | Category/subcategory dropdowns in create article modal |
| Context Menu (optional) | Not needed | User wants hover-triggered menus, not right-click -- use DropdownMenu |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core + @dnd-kit/sortable | @dnd-kit/react 0.2.4 | Newer API, but pre-1.0, minimal community examples for tree, not recommended |
| @dnd-kit | react-dnd | Abandoned, no React 19 support |
| @dnd-kit | react-beautiful-dnd | Deprecated by Atlassian, no React 18+ support |
| Custom DnD tree | dnd-kit-sortable-tree 0.1.73 | Premade tree component, but last published 2 years ago, limited customization |
| DropdownMenu | ContextMenu (right-click) | User explicitly wants hover-triggered '+' icon, not right-click |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npx shadcn@latest add select
```

## Architecture Patterns

### Existing Structure (relevant files)
```
src/
├── lib/
│   ├── db/schema.ts           # categories.parentCategoryId already exists
│   ├── wiki/queries.ts        # getCategoryTreeWithArticles already builds tree with children
│   ├── wiki/actions.ts        # Server actions (add article CRUD here)
│   ├── ai/pipeline.ts         # resolveOrCreateCategory needs subcategory support
│   ├── ai/prompts.ts          # DEFAULT_ANALYSIS_PROMPT needs subcategory rules
│   ├── ai/schemas.ts          # articlePlanSchema needs subcategory_suggestion field
│   └── ai/analyze.ts          # getFullCategoryTree already returns parentName
├── components/
│   ├── wiki/
│   │   ├── app-sidebar.tsx    # Renders sidebar (add DnD wrapper, context menus)
│   │   ├── category-tree.tsx  # CategoryNode component (refactor for DnD + menus)
│   │   └── search-input.tsx   # Widen, center in header
│   └── ui/
│       ├── dialog.tsx         # Exists -- use for create article modal
│       ├── dropdown-menu.tsx  # Exists -- use for context menus
│       └── sidebar.tsx        # SidebarProvider, SidebarInset, etc.
├── app/
│   └── (wiki)/
│       ├── layout.tsx         # Header layout (restructure for centered search + create btn)
│       └── wiki/
│           └── [articleSlug]/
│               └── edit/page.tsx  # Navigate here after article creation
```

### New Files to Create
```
src/
├── lib/
│   └── wiki/
│       ├── category-actions.ts   # Server actions: createCategory, renameCategory, deleteCategory, reorderSidebar
│       └── article-actions.ts    # Server actions: createArticle, renameArticle, deleteArticle, moveArticle
├── components/
│   ├── wiki/
│   │   ├── sortable-sidebar.tsx  # DnD wrapper: DndContext + SortableContext + tree flattening
│   │   ├── sortable-item.tsx     # Individual draggable item (category, subcategory, or article)
│   │   ├── sidebar-context-menu.tsx  # Hover-triggered dropdown menus for sidebar items
│   │   └── create-article-modal.tsx  # Dialog with title + cascading category/subcategory picker
│   └── ui/
│       └── select.tsx            # shadcn Select component
├── app/
│   └── api/
│       └── wiki/
│           ├── categories/route.ts    # CRUD API for categories/subcategories
│           ├── articles/route.ts      # Create article API
│           └── reorder/route.ts       # Persist sort order changes from DnD
```

### Pattern 1: Flatten-Then-Reorder for DnD Tree
**What:** The dnd-kit sortable tree pattern flattens the hierarchical tree into a 1D array for drag operations, then reconstructs the tree after drops.
**When to use:** When implementing sortable nested lists with reparenting support.
**Example:**
```typescript
// Source: dnd-kit official sortable tree example
// https://github.com/clauderic/dnd-kit/blob/master/stories/3%20-%20Examples/Tree/SortableTree.tsx

interface FlattenedItem {
  id: string;
  parentId: string | null;
  depth: number;      // 0 = category, 1 = subcategory, 2 = article
  type: 'category' | 'subcategory' | 'article';
  name: string;
  collapsed: boolean;
  sortOrder: number;
}

// Flatten tree for SortableContext
function flattenTree(categories: CategoryWithArticles[]): FlattenedItem[] {
  const items: FlattenedItem[] = [];
  for (const cat of categories) {
    items.push({ id: cat.id, parentId: null, depth: 0, type: 'category', name: cat.name, collapsed: false, sortOrder: cat.sortOrder ?? 0 });
    // Direct articles under category
    for (const article of cat.articles) {
      items.push({ id: article.id, parentId: cat.id, depth: 1, type: 'article', name: article.title, collapsed: false, sortOrder: article.sortOrder ?? 0 });
    }
    // Subcategories
    for (const sub of cat.children) {
      items.push({ id: sub.id, parentId: cat.id, depth: 1, type: 'subcategory', name: sub.name, collapsed: false, sortOrder: sub.sortOrder ?? 0 });
      for (const article of sub.articles) {
        items.push({ id: article.id, parentId: sub.id, depth: 2, type: 'article', name: article.title, collapsed: false, sortOrder: article.sortOrder ?? 0 });
      }
    }
  }
  return items;
}

// After drop: rebuild tree + persist
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  // Calculate new parentId and sortOrder from drop position
  // POST to /api/wiki/reorder with { itemId, itemType, newParentId, newSortOrder }
  // Optimistically update local state, revert on error
}
```

### Pattern 2: Hover-Triggered DropdownMenu for Sidebar Context
**What:** A '+' icon appears on hover over sidebar items, opening a DropdownMenu with management actions.
**When to use:** For sidebar item management (admin-only).
**Example:**
```typescript
// Using existing DropdownMenu component (not ContextMenu)
<div className="group relative flex items-center">
  <SidebarMenuButton>{/* category name */}</SidebarMenuButton>
  {isAdmin && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Add Subcategory</DropdownMenuItem>
        <DropdownMenuItem>Add Article</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )}
</div>
```

### Pattern 3: Cascading Category/Subcategory Picker in Create Modal
**What:** Dynamic subcategory dropdown that appears only when the selected category has subcategories, with inline creation options.
**When to use:** Article creation modal.
**Example:**
```typescript
// Category dropdown with "+ New Category" at the bottom
<Select value={categoryId} onValueChange={(id) => {
  setCategoryId(id);
  setSubcategoryId(null); // Reset subcategory when category changes
}}>
  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
  <SelectContent>
    {categories.map(cat => (
      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
    ))}
    <SelectSeparator />
    <button onClick={() => setShowNewCategory(true)}>+ New Category</button>
  </SelectContent>
</Select>

{/* Dynamic subcategory dropdown -- only shows if selected category has children */}
{subcategories.length > 0 && (
  <Select value={subcategoryId} onValueChange={setSubcategoryId}>
    <SelectTrigger><SelectValue placeholder="Select subcategory (optional)" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="none">None (direct in category)</SelectItem>
      {subcategories.map(sub => (
        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
      ))}
      <SelectSeparator />
      <button onClick={() => setShowNewSubcategory(true)}>+ New Subcategory</button>
    </SelectContent>
  </Select>
)}
```

### Pattern 4: Auto-Save Reorder with Optimistic Updates
**What:** On drag-drop completion, immediately persist new sort order to the database. Use optimistic state update with rollback on error.
**When to use:** Drag-and-drop reordering.
**Example:**
```typescript
// Server action for batch reorder
"use server";
export async function reorderSidebarItems(updates: Array<{
  id: string;
  type: 'category' | 'article';
  parentId: string | null;  // New parent (for reparenting)
  sortOrder: number;
}>): Promise<{ success: boolean }> {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Unauthorized");

  const db = getDb();
  // Batch update all affected items
  for (const item of updates) {
    if (item.type === 'category') {
      await db.update(categories)
        .set({ sortOrder: item.sortOrder, parentCategoryId: item.parentId })
        .where(eq(categories.id, item.id));
    } else {
      await db.update(articles)
        .set({ sortOrder: item.sortOrder, categoryId: item.parentId })
        .where(eq(articles.id, item.id));
    }
  }
  revalidatePath("/");
  return { success: true };
}
```

### Anti-Patterns to Avoid
- **Building custom DnD from scratch:** The interaction model for tree DnD is extremely complex (depth calculation, collision detection, visual feedback). Use dnd-kit.
- **Right-click context menus for sidebar items:** User explicitly wants hover-triggered '+' icon, not right-click. Use DropdownMenu, not ContextMenu.
- **Nested SortableContexts:** Don't nest multiple SortableContexts for the tree. Flatten the tree into a single SortableContext -- this is the proven pattern for tree DnD in dnd-kit.
- **Full tree refetch on every reorder:** Use optimistic local state updates. Only POST the changed items to the server.
- **Allowing subcategory depth > 2:** Enforce in both UI (prevent dropping subcategory into subcategory) and server actions (validate parentCategoryId chain).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom mouse event tracking | @dnd-kit/core + @dnd-kit/sortable | Accessibility, keyboard support, touch support, collision detection, animation |
| Drop indicator line | Custom absolute-positioned div | dnd-kit DragOverlay + custom collision strategy | Position calculation, smooth animation, edge cases |
| Slug generation | Custom regex | Existing `generateSlug()` in pipeline.ts | Already handles edge cases, reuse it |
| Unique slug checking | Manual DB query | Existing `ensureUniqueSlug()` in pipeline.ts | Already handles collision resolution, extract to shared util |
| Category tree building | Custom tree traversal | Existing `getCategoryTreeWithArticles()` | Already handles parent-child resolution |

**Key insight:** The category tree infrastructure (parentCategoryId, tree building, breadcrumb chain) already exists. The work is extending the UI to expose it and adding management actions.

## Common Pitfalls

### Pitfall 1: DnD Tree Depth Enforcement
**What goes wrong:** Users can drag a subcategory into another subcategory, creating depth 3+.
**Why it happens:** dnd-kit doesn't know about business rules for max depth.
**How to avoid:** In the `onDragOver` handler, calculate the target depth based on the over item's depth. If dropping would exceed depth 2, reject the drop (return without moving). Also validate server-side in the reorder action.
**Warning signs:** Categories appearing nested 3+ levels deep in the sidebar.

### Pitfall 2: Mixed Content Ordering (Articles + Subcategories)
**What goes wrong:** When a category has both direct articles AND subcategories, drag reordering produces unexpected results.
**Why it happens:** The flatten algorithm must interleave articles and subcategories at the same depth level under a parent.
**How to avoid:** Treat all children of a category (both articles and subcategories) as siblings in the flat array. The `type` field on each item distinguishes them. Sort by `sortOrder` regardless of type.
**Warning signs:** Articles always appearing before/after subcategories regardless of drag order.

### Pitfall 3: Sidebar Data Staleness After Mutations
**What goes wrong:** After creating an article, renaming a category, or reordering via DnD, the sidebar doesn't update.
**Why it happens:** The sidebar data is fetched server-side in `layout.tsx` and passed as props. Client-side mutations don't trigger re-fetch.
**How to avoid:** Use `router.refresh()` after mutations to re-run the server component and refetch sidebar data. For DnD, use optimistic client state AND `router.refresh()` after the server persists.
**Warning signs:** New articles not appearing in sidebar until page refresh.

### Pitfall 4: Conflicting DnD and Collapsible Behavior
**What goes wrong:** Clicking to expand/collapse a category triggers a drag start instead.
**Why it happens:** Both collapsible trigger and drag handle listen to pointer events on the same element.
**How to avoid:** Use a separate drag handle (GripVertical icon) that only appears on hover. The category name/chevron handles expand/collapse. The drag handle is a separate element that dnd-kit attaches listeners to via `useSortable({ activationConstraint: { distance: 5 } })`.
**Warning signs:** Impossible to expand categories without accidentally dragging.

### Pitfall 5: Category Deletion Cascade
**What goes wrong:** Deleting a category that has articles causes orphaned articles or FK constraint errors.
**Why it happens:** The schema uses `references(() => categories.id)` without `onDelete` on `articles.categoryId`.
**How to avoid:** Enforce the business rule: deletion blocked if category contains articles. Check both direct articles AND subcategories before allowing delete. Return a clear error message.
**Warning signs:** 500 errors when deleting categories.

### Pitfall 6: AI Pipeline Subcategory Confusion
**What goes wrong:** AI creates subcategories when it shouldn't, or fails to use existing subcategories.
**Why it happens:** Prompt doesn't clearly explain when subcategories are appropriate vs. direct articles.
**How to avoid:** Add explicit rules to the analysis prompt: subcategories for >8 articles in a category with distinct sub-topics. Always show the full tree hierarchy in prompt context (Category > Subcategory notation).
**Warning signs:** Every category getting an unnecessary subcategory, or AI ignoring existing subcategories.

### Pitfall 7: Inline Category Creation Race Conditions
**What goes wrong:** Two users (or the same user rapidly) create a category with the same name, causing unique constraint violation.
**Why it happens:** The `categories.slug` column has a unique constraint.
**How to avoid:** Use `onConflictDoNothing()` like the existing `resolveOrCreateCategory` in pipeline.ts. After insert attempt, look up the existing record if conflict occurs.
**Warning signs:** Error toasts when creating categories.

## Code Examples

### Article Creation Server Action
```typescript
// Source: Pattern derived from existing regenerateArticle in wiki/actions.ts
"use server";

export async function createArticle(data: {
  title: string;
  categoryId: string;
  subcategoryId?: string | null;
}): Promise<{ slug: string } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const db = getDb();

  // Determine the actual categoryId (subcategory takes precedence)
  const effectiveCategoryId = data.subcategoryId || data.categoryId;

  // Generate unique slug
  const baseSlug = generateSlug(data.title);
  const slug = await ensureUniqueSlug(baseSlug);

  // Create article with minimal content
  const [newArticle] = await db.insert(articles).values({
    title: data.title,
    slug,
    contentMarkdown: "",
    contentJson: null,
    categoryId: effectiveCategoryId,
    hasHumanEdits: false,
    needsReview: false,
  }).returning({ id: articles.id, slug: articles.slug });

  // Create initial empty version
  await createArticleVersion({
    articleId: newArticle.id,
    contentMarkdown: "",
    changeSource: "human_edited",
    changeSummary: "Article created manually",
    createdBy: session.user.id,
  });

  revalidatePath("/");
  return { slug: newArticle.slug };
}
```

### AI Schema Update for Subcategory
```typescript
// Source: Extension of existing articlePlanSchema in ai/schemas.ts
export const articlePlanSchema = z.object({
  // ... existing fields ...
  category_suggestion: z.string().describe("Slug of the suggested category (prefer existing categories)"),
  subcategory_suggestion: z.string().nullable().describe("Slug of the suggested subcategory within the category, or null if article should be directly in the category"),
  // ... rest of fields ...
});
```

### Pipeline resolveOrCreateCategory Extension
```typescript
// Source: Extension of existing resolveOrCreateCategory in pipeline.ts
// Now accepts optional subcategory suggestion
async function resolveOrCreateCategory(
  categorySuggestion: string,
  subcategorySuggestion: string | null,
  categoryTree: Array<{ id: string; name: string; slug: string; parentName?: string }>
): Promise<string | null> {
  // First, resolve the parent category (existing logic)
  const parentId = await resolveParentCategory(categorySuggestion, categoryTree);
  if (!parentId) return null;

  // If no subcategory suggested, return the parent
  if (!subcategorySuggestion) return parentId;

  // Resolve or create subcategory under the parent
  return resolveOrCreateSubcategory(subcategorySuggestion, parentId, categoryTree);
}
```

### Header Layout with Centered Search
```typescript
// Source: Modification of existing (wiki)/layout.tsx header
<header className="flex h-14 items-center gap-2 border-b px-4">
  {/* Left section: sidebar trigger + Ask AI */}
  <div className="flex items-center gap-2">
    <AskAiGlobalTrigger />
  </div>

  {/* Center section: wider search bar */}
  <div className="flex-1 flex justify-center">
    <div className="w-full max-w-xl">
      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <SearchInput />
      </Suspense>
    </div>
  </div>

  {/* Right section: create button + admin + user */}
  <div className="flex items-center gap-2">
    {user.role === "admin" && (
      <CreateArticleButton categories={categoryTree} />
    )}
    {/* ... existing admin/user buttons */}
  </div>
</header>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core + @dnd-kit/sortable | 2022+ | rbd deprecated, dnd-kit is the standard |
| @dnd-kit/core (all-in-one) | @dnd-kit/react (new API) | 2025 | New API still pre-1.0 (0.2.x), not recommended for production yet |
| Right-click context menus | Hover action buttons | Design trend | Modern UIs prefer visible-on-hover actions over hidden right-click |
| Manual sort order management | Fractional indexing | Ongoing | Not needed here -- simple integer sortOrder with batch update sufficient for sidebar scale |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated by Atlassian, no React 18+ support
- `react-dnd`: Unmaintained, no React 19 support
- `@dnd-kit/react` 0.2.x: Too new/unstable for production tree DnD

## Database Changes Required

### No New Tables Needed
The existing schema already supports subcategories via `categories.parentCategoryId` self-reference.

### Schema Observations
- `categories.sortOrder`: Already exists as `integer("sort_order")` -- used for DnD reorder persistence
- `categories.parentCategoryId`: Already exists as `uuid("parent_category_id")` self-reference -- used for subcategory nesting
- `articles.sortOrder`: Already exists as `integer("sort_order")` -- used for DnD reorder persistence
- `articles.categoryId`: Already exists as `uuid("category_id")` -- used for article placement (can point to subcategory)
- `categories.slug`: Has `unique()` constraint -- inline category creation must handle conflicts

### No Migration Needed
All required columns already exist. The 2-level nesting is a UI/business logic constraint, not a schema constraint.

## AI Pipeline Changes Summary

### Files to Modify
1. **`src/lib/ai/schemas.ts`**: Add `subcategory_suggestion` field to `articlePlanSchema`
2. **`src/lib/ai/prompts.ts`**: Update `DEFAULT_ANALYSIS_PROMPT` Category Strategy section to include subcategory rules; update `buildAnalysisPrompt` to show subcategory hierarchy in category tree context
3. **`src/lib/ai/pipeline.ts`**: Update `resolveOrCreateCategory` to handle subcategory creation; update `processCreateArticle` and `processUpdateArticle` to pass subcategory suggestion
4. **`src/lib/ai/analyze.ts`**: Update `getFullCategoryTree` to include subcategory depth info in prompt context
5. **`src/lib/ai/plan.ts`**: Update `buildPlanningPrompt` to include subcategory awareness

### Prompt Strategy for Subcategories
Add to Category Strategy section:
```
**Rule 7: Subcategory creation.** Only create subcategories when a category has
8+ articles covering distinct sub-topics. Subcategories group related articles
within a category. Maximum depth is 2 levels (Category > Subcategory). Never
create a subcategory with fewer than 3 articles.

**Rule 8: Subcategory naming.** Subcategory names should be short topic labels
(e.g., "Authentication", "Settings", "Permissions") NOT full phrases. They
describe a sub-topic within the parent category.
```

## Open Questions

1. **Slug uniqueness for categories vs articles**
   - What we know: Both `categories.slug` and `articles.slug` have unique constraints. Categories need slugs for URL routing (`/wiki/category/[slug]`).
   - What's unclear: Can a category and an article share the same slug? They're in different tables with separate unique constraints, so technically yes.
   - Recommendation: Keep them separate. The URL structure already disambiguates (`/wiki/category/X` vs `/wiki/X`).

2. **DnD activation constraint tuning**
   - What we know: Need to prevent accidental drags when clicking to expand/collapse.
   - What's unclear: Exact distance threshold for drag activation.
   - Recommendation: Start with `activationConstraint: { distance: 8 }` and tune during testing. This means the user must drag 8px before it registers as a drag.

3. **Batch reorder strategy: update all siblings or just moved item?**
   - What we know: After a DnD operation, sortOrder needs updating.
   - What's unclear: Is it cheaper to update just the moved item or renumber all siblings?
   - Recommendation: Update all siblings in the affected parent(s). Simple integer sequence (0, 1, 2, ...) prevents gaps and is predictable. Sidebar scale is small enough (<100 items) that batch update is instant.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/db/schema.ts`, `src/lib/ai/pipeline.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/schemas.ts`, `src/lib/ai/analyze.ts`, `src/lib/wiki/queries.ts`, `src/lib/wiki/actions.ts`, `src/components/wiki/category-tree.tsx`, `src/components/wiki/app-sidebar.tsx`, `src/app/(wiki)/layout.tsx`
- npm registry: `@dnd-kit/core@6.3.1` peerDependencies verified (react >=16.8.0)
- npm registry: `@dnd-kit/sortable@10.0.0` peerDependencies verified
- [dnd-kit official sortable tree example](https://github.com/clauderic/dnd-kit/blob/master/stories/3%20-%20Examples/Tree/SortableTree.tsx)
- [dnd-kit documentation](https://docs.dndkit.com/)

### Secondary (MEDIUM confidence)
- [shadcn/ui Context Menu docs](https://ui.shadcn.com/docs/components/radix/context-menu) - confirmed hover DropdownMenu is better fit than right-click ContextMenu
- [Radix UI DropdownMenu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu) - already in project
- [@dnd-kit/react migration guide](https://docs.dndkit.com/react/guides/migration) - confirmed 0.2.x is new API, not yet stable

### Tertiary (LOW confidence)
- [dnd-kit-sortable-tree community package](https://www.npmjs.com/package/dnd-kit-sortable-tree) - last published 2 years ago, not recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @dnd-kit/core 6.3.1 is battle-tested, peer deps verified against React 19
- Architecture: HIGH - Existing codebase structure thoroughly analyzed, patterns derived from actual code
- Pitfalls: HIGH - Derived from real codebase constraints (FK relationships, sidebar data flow, DnD interaction conflicts)
- AI Pipeline: MEDIUM - Subcategory rules in prompts need testing/tuning, but the code changes are straightforward extensions of existing patterns

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable libraries, project-specific patterns)
