# Phase 10: Navigation and Article Creation - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add subcategory support to the wiki's category system (2 levels max: Category > Subcategory > Articles), enable drag-and-drop reorganization of the entire sidebar tree, allow admins to manually create articles via a header button, and update the AI pipeline prompts/code to understand and generate subcategories. Redesign the header search bar to be centered and larger. Add context menus to sidebar items for inline management.

</domain>

<decisions>
## Implementation Decisions

### Nested Categories (Subcategories)
- Maximum nesting depth: 2 levels (Category > Subcategory > Articles). No deeper.
- AI pipeline CAN create subcategories automatically during article generation — prompts and analysis code must be updated to understand subcategories
- A category can contain both direct articles AND subcategories at the same level (mixed content)
- Subcategories are collapsible in the sidebar, same pattern as categories
- Empty categories and subcategories are shown in the sidebar (not hidden)
- Only admins can create, rename, and delete categories/subcategories
- Deletion is blocked if a category/subcategory still contains articles — must move articles out first

### Drag-and-Drop Organization
- Admin-only: only admins can drag-and-drop
- Always active for admins — no edit mode toggle. Drag handles visible on hover.
- Auto-save immediately on drop — no separate save action
- Everything is draggable: categories, subcategories, and articles
- Full reparenting: articles can be dropped at any level (into subcategories, directly into categories, between items)
- Subcategories can be moved between categories freely
- Visual feedback: drop indicator line (blue line between items showing where the drop will land)

### Article Creation
- Admin-only: only admins can create articles manually
- Create button in header: primary styled button (filled/colored), to the right of the search bar
- Create button only visible to admins — hidden from non-admins entirely
- Opens a modal dialog with: title input, category dropdown, dynamic subcategory dropdown (appears only if selected category has subcategories)
- Minimum required: title + category. Subcategory optional.
- Inline creation: both '+ New Category' and '+ New Subcategory' options available in the dropdowns within the modal
- After creation: user is navigated to the new article's editor (BlockNote) immediately

### Header & Search Bar
- Search bar: center-aligned in header, wider than current (roughly 2x width). Same functionality as now, just bigger and centered.
- Create button to the right of the search bar

### Sidebar Context Menus
- Categories get hover '+' icon (appears on hover only, not always visible) that opens a context menu
- Category context menu options: Add Subcategory, Add Article, Rename, Delete
- Subcategories get the same hover context menu pattern: Add Article, Rename, Delete
- Articles get a hover context menu: Rename, Delete, Move to... (category picker)
- All sidebar context menus are admin-only

### AI Pipeline Updates
- Prompts must be updated so AI knows about the subcategory concept
- Analysis prompt needs rules for when to create subcategories vs. keep articles directly in a category
- Code that generates and places articles must handle the parentCategoryId / subcategory relationship
- Existing category anchoring strategy (Phase 8) extends to subcategories

</decisions>

<specifics>
## Specific Ideas

- Header layout: search bar centered and significantly wider, Create button as primary action to its right
- Sidebar context menus appear on hover — keeps sidebar clean when not actively managing
- Drop indicator line (blue) for drag-and-drop visual feedback — like file managers
- Create modal with cascading category > subcategory picker, with inline creation for both
- The entire sidebar tree should feel manageable — categories, subcategories, and articles all draggable by admins with immediate persistence

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-navigation-and-article-creation*
*Context gathered: 2026-02-14*
