---
phase: 05-article-editing
verified: 2026-02-13T00:00:00Z
status: gaps_found
score: 38/42 must-haves verified
re_verification: true
previous_status: passed
previous_score: 29/29
gaps_closed: []
gaps_remaining:
  - "Plan 05-08 Task 3: User menu relocation to header"
gaps:
  - truth: "User avatar icon appears in the top-right header bar next to the search input"
    status: failed
    reason: "UserMenu still in sidebar footer, not moved to header"
    artifacts:
      - path: "src/app/(wiki)/layout.tsx"
        issue: "No UserMenu or Settings icon in header"
      - path: "src/components/wiki/app-sidebar.tsx"
        issue: "UserMenu still in SidebarFooter"
      - path: "src/components/common/user-menu.tsx"
        issue: "User name still in trigger, 'Profile' not 'Account Settings', Admin link in dropdown"
    missing:
      - "Move UserMenu from sidebar footer to wiki layout header"
      - "Add Settings cog icon for admins in header"
      - "Update UserMenu trigger to avatar-only"
      - "Change 'Profile' link to 'Account Settings'"
      - "Remove Admin link from dropdown (replaced by cog)"
---

# Phase 5: Article Editing & Version History Verification Report (Re-verification)

**Phase Goal:** Users can edit articles with a rich editor, upload images, and track all changes with full version history

**Verified:** 2026-02-13T00:00:00Z

**Status:** GAPS_FOUND

**Re-verification:** Yes — after gap closure plans 05-05 through 05-08

## Re-verification Summary

**Previous verification:** 2026-02-14T03:01:11Z — status: passed (29/29 must-haves)

**This verification:** Plans 05-05 through 05-08 added 13 new truths to phase scope. Current score: 38/42.

**Gaps closed:** None (previous verification had no gaps)

**New gaps:** 4 truths from Plan 05-08 Task 3 (user menu relocation) NOT implemented

**Regressions:** None (all previous 29 truths still verified)

## Goal Achievement

### Observable Truths (10 ROADMAP Success Criteria)

#### Original Phase Scope (Plans 01-04) — Previously Verified

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can edit any article in a WYSIWYG editor (BlockNote) with toolbar support | ✓ VERIFIED | Previous verification confirmed (regression check: article-editor.tsx exists, 7473 bytes) |
| 2 | User can paste or upload images (auto-compressed, local filesystem) | ✓ VERIFIED | Previous verification confirmed (regression check: compress.ts, storage.ts, images API exist) |
| 3 | Editor auto-saves drafts as version records with changeSource "draft" | ✓ VERIFIED | Plan 05-06 implemented: draft API route exists, saveDraft in article-editor.tsx (line 136), no localStorage refs |
| 4 | User can view full version history, filter by source, compare versions with diff | ✓ VERIFIED | Previous verification confirmed (regression check: version-history.tsx exists, 12863 bytes) |
| 5 | User can click any version history record to preview rendered formatted text | ✓ VERIFIED | Plan 05-07 implemented: Eye button (line 291), VersionPreview component exists (2958 bytes) |
| 6 | User can restore (rollback) any article to a previous version | ✓ VERIFIED | Previous verification confirmed (regression check: restore/route.ts exists) |
| 7 | AI review annotations after merge with collapsible banner | ✓ VERIFIED | Previous verification confirmed (Plan 04 all truths verified) |
| 8 | Article page shows collapsible annotation banner | ✓ VERIFIED | Previous verification confirmed (annotation-banner.tsx exists) |
| 9 | User can toggle between auto/light/dark mode from profile page | ✓ VERIFIED | Plan 05-08 Task 1-2: ThemeProvider in layout.tsx, theme toggle in profile-form.tsx |
| 10 | Admin has centralized Review Queue page | ✓ VERIFIED | Plan 05-05: /admin/review-queue page exists, getReviewQueueItems query verified |

**Score:** 10/10 ROADMAP success criteria verified

### Detailed Truths (All 8 Plans)

#### Plans 01-04 (29 truths) — Previously Verified ✓

All 29 truths from previous verification remain verified (regression check passed).

#### Plan 05-05: Admin Review Queue (6 truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 30 | Admin can navigate to /admin/review-queue and see list of articles needing attention | ✓ VERIFIED | page.tsx exists, imports getReviewQueueItems, renders ReviewQueueList |
| 31 | Each item shows article title, category, reason, last updated date | ✓ VERIFIED | review-queue-list.tsx lines: title, category badge, reason indicators visible |
| 32 | Admin can filter queue by category using dropdown | ✓ VERIFIED | review-queue-list.tsx has category filter select |
| 33 | Admin can search queue by article title | ✓ VERIFIED | review-queue-list.tsx has search Input component |
| 34 | Admin can sort queue by date (newest/oldest first) | ✓ VERIFIED | review-queue-list.tsx has sort select dropdown |
| 35 | Clicking item navigates to article page | ✓ VERIFIED | review-queue-list.tsx Link href="/wiki/${item.slug}" |

**Artifacts:**
- `src/app/(admin)/admin/review-queue/page.tsx` — ✓ EXISTS (803 bytes)
- `src/app/(admin)/admin/review-queue/review-queue-list.tsx` — ✓ EXISTS (5476 bytes)
- `src/lib/wiki/queries.ts` (getReviewQueueItems) — ✓ WIRED (line 647)

**Key Links:**
- page.tsx → getReviewQueueItems — ✓ WIRED (line 6: await getReviewQueueItems())
- review-queue-list.tsx → /wiki/[slug] — ✓ WIRED (Link href pattern verified)

#### Plan 05-06: Draft as Version (6 truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 36 | changeSourceEnum includes 'draft' as valid value | ✓ VERIFIED | schema.ts lines 38: "draft" in enum |
| 37 | Editor auto-saves draft as version record with changeSource 'draft' | ✓ VERIFIED | article-editor.tsx line 136: saveDraft function, line 159: debounced call, draft/route.ts line 81 |
| 38 | Draft version records appear in history with distinct styling | ✓ VERIFIED | version-history.tsx has border-dashed styling for draft, Draft badge |
| 39 | User can filter version history to show draft versions | ✓ VERIFIED | version-history.tsx SOURCE_FILTERS includes { label: "Draft", value: "draft" } |
| 40 | localStorage auto-save replaced by server-side drafts | ✓ VERIFIED | No localStorage refs in article-editor.tsx (grep returned empty) |
| 41 | Draft recovery checks server instead of localStorage | ✓ VERIFIED | article-editor.tsx fetches GET /api/articles/${articleId}/draft on mount |

**Artifacts:**
- `src/lib/db/schema.ts` (changeSourceEnum with draft) — ✓ EXISTS, SUBSTANTIVE (line 38)
- `src/app/api/articles/[id]/draft/route.ts` — ✓ EXISTS (4369 bytes), exports GET, PUT, DELETE
- `src/components/editor/article-editor.tsx` (server-side draft auto-save) — ✓ MODIFIED, WIRED
- `src/components/wiki/version-history.tsx` (draft styling) — ✓ MODIFIED

**Key Links:**
- article-editor.tsx → /api/articles/[id]/draft — ✓ WIRED (PUT on line 143, GET on mount, DELETE on save)
- version-history.tsx → draft badge — ✓ WIRED (case "draft" in ChangeSourceBadge)

#### Plan 05-07: Version Preview (5 truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 42 | User can click any version history record to open slide-out panel | ✓ VERIFIED | version-history.tsx line 291: Eye icon button, onClick sets previewVersion |
| 43 | Slide-out shows version markdown rendered as formatted HTML | ✓ VERIFIED | version-preview.tsx renders Markdown component in prose wrapper |
| 44 | Slide-out includes version metadata (date, source, creator, summary) | ✓ VERIFIED | version-preview.tsx SheetDescription shows metadata |
| 45 | User can close slide-out without restore action | ✓ VERIFIED | version-preview.tsx Sheet onOpenChange handler |
| 46 | Slide-out works independently of selection system | ✓ VERIFIED | Eye button has e.stopPropagation() to prevent selection toggle |

**Artifacts:**
- `src/components/wiki/version-preview.tsx` — ✓ EXISTS (2958 bytes), Sheet with Markdown rendering
- `src/components/wiki/version-history.tsx` (Eye button) — ✓ MODIFIED, imports VersionPreview

**Key Links:**
- version-history.tsx → version-preview.tsx — ✓ WIRED (line 368: renders VersionPreview)
- version-preview.tsx → Sheet — ✓ WIRED (imports and renders Sheet)

#### Plan 05-08: Dark Mode and User Menu Relocation (9 truths planned)

**Implemented (5 truths):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 47 | User can toggle between auto/light/dark mode from profile page | ✓ VERIFIED | profile-form.tsx has System/Light/Dark toggle buttons |
| 48 | Theme preference persists in users table | ✓ VERIFIED | schema.ts has themePreference column, updateThemePreference server action in actions.ts |
| 49 | Theme applies app-wide via ThemeProvider in root layout | ✓ VERIFIED | layout.tsx line 34: ThemeProvider with attribute="class", enableSystem |
| 50 | BlockNote editor respects current theme | ✓ VERIFIED | article-editor.tsx line 56: useTheme, line 280: theme={resolvedTheme === "dark" ? "dark" : "light"} |
| 51 | html element has class='dark' when dark mode active | ✓ VERIFIED | layout.tsx line 29: suppressHydrationWarning, ThemeProvider attribute="class" |

**NOT Implemented (4 truths from Task 3):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 52 | User avatar icon appears in top-right header bar next to search input | ✗ FAILED | UserMenu still in sidebar footer (app-sidebar.tsx line 56-60), not in wiki layout header |
| 53 | Clicking avatar shows dropdown with user name, Account Settings link, Log Out | ✗ FAILED | user-menu.tsx line 57: still "Profile" not "Account Settings", line 43: name in trigger |
| 54 | Settings cog icon appears next to avatar (admin only) | ✗ FAILED | No Settings icon in wiki layout.tsx header |
| 55 | Sidebar footer no longer contains user menu | ✗ FAILED | app-sidebar.tsx lines 56-60: SidebarFooter still contains UserMenu |

**Artifacts (Plan 05-08):**
- `src/components/common/theme-provider.tsx` — ✓ EXISTS (267 bytes)
- `src/app/layout.tsx` (ThemeProvider) — ✓ MODIFIED, WIRED
- `src/lib/db/schema.ts` (themePreference column) — ✓ MODIFIED
- `src/app/(wiki)/profile/profile-form.tsx` (theme toggle) — ✓ MODIFIED
- `src/app/(wiki)/layout.tsx` (header with user menu) — ✗ NOT MODIFIED (UserMenu not in header)
- `src/components/wiki/app-sidebar.tsx` (UserMenu removed) — ✗ NOT MODIFIED (UserMenu still in footer)
- `src/components/common/user-menu.tsx` (avatar-only, Account Settings) — ✗ NOT MODIFIED (name in trigger, "Profile" link)

**Key Links (Plan 05-08):**
- layout.tsx → ThemeProvider — ✓ WIRED (line 34)
- profile-form.tsx → useTheme — ✓ WIRED
- article-editor.tsx → useTheme — ✓ WIRED (line 56)
- **wiki layout.tsx → UserMenu in header — ✗ NOT WIRED (still in sidebar)**
- **wiki layout.tsx → Settings icon — ✗ NOT WIRED (doesn't exist)**

### Requirements Coverage

All 13 original requirements (EDIT-01 through VERS-05) remain satisfied (previous verification confirmed).

**Additional Phase 5 Requirements (Extended Scope):**

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Admin Review Queue centralized dashboard | ✓ SATISFIED | Plan 05-05 verified |
| Draft-as-version with one per user per article | ✓ SATISFIED | Plan 05-06 verified |
| Version preview slide-out panel | ✓ SATISFIED | Plan 05-07 verified |
| Light/dark mode with theme persistence | ✓ SATISFIED | Plan 05-08 Tasks 1-2 verified |
| User menu in header with admin settings cog | ✗ BLOCKED | Plan 05-08 Task 3 not implemented |

### Anti-Patterns Found

No blocker anti-patterns detected in new code.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| N/A | N/A | N/A | N/A |

### Human Verification Required

The following NEW items require human testing (original 6 items from previous verification still apply):

#### 7. Admin Review Queue Filtering and Sorting

**Test:** Navigate to /admin/review-queue. Type in search box, select a category from filter, change sort order.

**Expected:**
- Search filters items by article title (case-insensitive)
- Category filter shows only items from selected category
- Sort dropdown changes order (newest vs oldest)
- All three controls work together correctly

**Why human:** Client-side filtering and sorting logic requires interactive testing.

#### 8. Draft Auto-Save to Server

**Test:** Edit an article, make changes, wait 3+ seconds without saving. Check version history.

**Expected:**
- Draft version appears in history with "Draft" badge and dashed border
- Draft has distinct visual styling from other versions
- Draft updates on subsequent changes (upsert pattern)
- Clicking save removes the draft record

**Why human:** Debounced auto-save timing and visual styling require interactive testing.

#### 9. Version Preview Slide-Out

**Test:** Open History tab, click Eye icon on any version.

**Expected:**
- Slide-out panel appears from right side
- Version content rendered as formatted markdown (not raw text)
- Metadata header shows date, source badge, creator, change summary
- Closing panel doesn't affect version selection

**Why human:** Slide-out animation, markdown rendering fidelity, and interaction independence require manual testing.

#### 10. Dark Mode Theme Switching

**Test:** Navigate to /profile. Click System/Light/Dark buttons. Reload page. Log out and log back in.

**Expected:**
- Theme switches immediately when button clicked
- Dark mode applies app-wide (sidebar, header, content, modals)
- BlockNote editor switches between light/dark theme
- Theme persists after page reload
- Theme persists after logout/login
- Auto mode follows system preference

**Why human:** Visual theme consistency across all UI elements, persistence verification, and system preference detection require manual testing.

---

## Gaps Summary

**Scope:** Plan 05-08 Task 3 (User Menu Relocation to Header)

**What's missing:**
1. UserMenu component still in sidebar footer (should be in wiki layout header)
2. UserMenu trigger still shows user name (should be avatar-only)
3. UserMenu link says "Profile" (should say "Account Settings")
4. Admin link still in UserMenu dropdown (should be removed, replaced by separate Settings cog)
5. No Settings cog icon in header for admins

**Why this matters:**
- The phase goal includes "User avatar icon appears in the top-right header bar" (ROADMAP success criterion 9, sub-item 6)
- Current implementation keeps old UX pattern (user menu in sidebar)
- Missing Settings cog icon makes admin access less discoverable

**Recommended action:**
Execute Plan 05-08 Task 3 as written (3 files to modify: wiki layout.tsx, app-sidebar.tsx, user-menu.tsx).

---

## Overall Assessment

**Status:** GAPS_FOUND

**Score:** 38/42 observable truths verified (90.5%)

**Phase Goal Achievement:** PARTIAL

**What works:**
- All original scope (Plans 01-04) verified and functioning
- Admin Review Queue fully implemented (Plan 05-05)
- Draft-as-version fully implemented (Plan 05-06)
- Version preview slide-out fully implemented (Plan 05-07)
- Dark mode theme system fully implemented (Plan 05-08 Tasks 1-2)

**What's missing:**
- User menu relocation to header (Plan 05-08 Task 3)
- Settings cog icon for admins
- Updated UserMenu component (avatar-only trigger, "Account Settings" label)

**Impact:** Low-medium. The missing Task 3 is a UX improvement, not a functional blocker. All core editing, versioning, and theme features work. However, the ROADMAP explicitly lists "User avatar icon appears in the top-right header bar" as a success criterion, making this a documented gap.

**Re-verification needed:** Yes — after executing Plan 05-08 Task 3.

---

_Verified: 2026-02-13T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
