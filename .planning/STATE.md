# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions
**Current focus:** Phase 11 — Add Review To Articles Too

## Current Position

Phase: 11 of 11 (Add Review To Articles Too — IN PROGRESS)
Plan: 1 of 2 in Phase 11 (Plan 01 complete)
Status: Plan 11-01 complete, Plan 11-02 pending
Last activity: 2026-02-16 -- Completed 11-01 (article review queue tab and comment counts)

Progress: [████████████████████] 97% (38/39 plans across phases 1-11)

## Performance Metrics

**Velocity:**
- Total plans completed: 38
- Average duration: 3min
- Total execution time: ~1.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 15min | 5min |
| 02 | 3 | 11min | 4min |
| 03 | 4 | 13min | 3min |
| 04 | 5 | 14min | 3min |
| 05 | 8 | 23min | 3min |
| 06 | 3 | 11min | 4min |
| 07 | 3 | 12min | 4min |
| 08 | 4 | 5min | 1min |
| 09 | 1 | 5min | 5min |
| 10 | 4/4 | 12min | 3min |
| 11 | 1/2 | 3min | 3min |

*Updated after each plan completion*

## Deliverables

### Phase 9 Documentation Outputs

- `docs/application-guide.md` — Comprehensive 18-section guide covering architecture, setup, and all features
- `docs/ai-pipeline.md` — Reviewed and updated pipeline deep-dive with category strategy and article style rules
- `docs/ultrawiki-spec.md` — Updated to v1.0.0, reflecting as-built state (per-prompt models, cron instead of pgboss, raw fetch for notifications, implementation checklist marked complete)

## Accumulated Context

### Roadmap Evolution
- Phase 10 added: Navigation and Article Creation
- Phase 11 added: Add Review To Articles Too

### Phase 10 Decisions
- Slug generation for categories/articles reuses pipeline.ts pattern for consistency
- renameArticle does NOT change slug to keep URLs stable
- deleteArticle explicitly deletes related records for safety (defensive against missing DB cascades)
- createCategory uses onConflictDoNothing for slug race condition handling
- subcategory_suggestion is nullable string (null = no subcategory, preserving default behavior)
- Max hierarchy depth 2 levels (Category > Subcategory) enforced by prompt rules
- Subcategory resolution matches by slug AND parentCategoryId to avoid cross-parent collisions
- Inline category/subcategory creation in modal uses button outside Radix SelectContent to avoid auto-close
- Header layout: 3-section flexbox (left AskAi, center search max-w-xl, right actions+user)
- Categories/subcategories use Plus icon trigger; articles use Ellipsis trigger for context menus
- Article delete uses AlertDialog confirmation; category/subcategory delete relies on server-side article guard

### Phase 11 Decisions
- Review count = (needsReview ? 1 : 0) + annotationCount for consistent counting
- ArticleReviewQueue is simpler article-scoped view without admin search/filter/sort controls
- Comment count and review count fetched server-side to avoid tab label layout flash
- Non-admin users get undefined for reviewQueueContent so Review Queue tab never renders

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 11-01-PLAN.md (article review queue tab and comment counts)
Next: Plan 11-02 — Sidebar review badges
