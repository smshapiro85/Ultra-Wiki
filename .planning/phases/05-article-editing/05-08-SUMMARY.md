---
phase: 05-article-editing
plan: 08
subsystem: ui
tags: [next-themes, dark-mode, theme-toggle, blocknote, tailwind]

# Dependency graph
requires:
  - phase: 05-06
    provides: "Server-side draft auto-save and editor infrastructure"
provides:
  - "ThemeProvider with class-based dark mode in root layout"
  - "users.themePreference column persisting theme choice"
  - "Profile page theme toggle (System/Light/Dark)"
  - "BlockNote editor theme-awareness via resolvedTheme"
affects: [all-phases]

# Tech tracking
tech-stack:
  added: [next-themes]
  patterns: [class-based dark mode via ThemeProvider, useTheme for client-side theme switching, resolvedTheme for system preference resolution]

key-files:
  created:
    - src/components/common/theme-provider.tsx
  modified:
    - src/lib/db/schema.ts
    - src/app/layout.tsx
    - src/app/(wiki)/profile/page.tsx
    - src/app/(wiki)/profile/profile-form.tsx
    - src/app/(wiki)/profile/actions.ts
    - src/components/editor/article-editor.tsx

key-decisions:
  - "Text column for themePreference (not enum) -- three values don't need Postgres enum, avoids migration complexity"
  - "useTheme for immediate client-side switching + server action for DB persistence -- dual strategy for responsiveness"

patterns-established:
  - "ThemeProvider wrapping in root layout with attribute=class for Tailwind dark: classes"
  - "resolvedTheme from next-themes to determine actual theme (accounts for system preference)"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 5 Plan 8: Dark Mode Summary

**Light/dark mode via next-themes with class-based Tailwind strategy, theme toggle in profile, DB persistence, and BlockNote editor theme-awareness**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T06:07:02Z
- **Completed:** 2026-02-14T06:09:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ThemeProvider configured in root layout with class-based dark mode and system preference support
- Profile page has System/Light/Dark toggle buttons with immediate client-side switching and DB persistence
- BlockNote editor respects current theme via resolvedTheme (handles system preference resolution)
- users table has themePreference column with "system" default for cross-session persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Add themePreference column, create ThemeProvider, and wire into root layout** - `e02ed7d` (feat)
2. **Task 2: Add theme toggle to profile page and make editor theme-aware** - `0d758e1` (feat)

## Files Created/Modified
- `src/components/common/theme-provider.tsx` - Client wrapper for next-themes ThemeProvider
- `src/lib/db/schema.ts` - Added themePreference text column to users table
- `src/app/layout.tsx` - Wrapped children with ThemeProvider, added suppressHydrationWarning
- `src/app/(wiki)/profile/page.tsx` - Pass themePreference to ProfileForm
- `src/app/(wiki)/profile/profile-form.tsx` - Theme toggle buttons with useTheme hook
- `src/app/(wiki)/profile/actions.ts` - updateThemePreference server action
- `src/components/editor/article-editor.tsx` - BlockNoteView uses resolvedTheme for light/dark

## Decisions Made
- Text column for themePreference instead of Postgres enum -- three values (system/light/dark) don't warrant enum complexity
- Dual approach: useTheme for immediate client-side switch + server action for DB persistence ensures responsive UX
- suppressHydrationWarning on html element required by next-themes to prevent hydration mismatch
- resolvedTheme used instead of theme for BlockNote -- correctly handles "system" by resolving to actual preference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dark mode support is fully wired across the app
- All Phase 5 gap closure plans (05-05 through 05-08) are now complete
- Phase 5 (Article Editing) is fully delivered

## Self-Check: PASSED

All 6 key files verified present. Both task commits (e02ed7d, 0d758e1) verified in git log.

---
*Phase: 05-article-editing*
*Completed: 2026-02-14*
