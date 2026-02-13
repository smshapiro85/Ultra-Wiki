---
phase: 02-admin-settings-and-github-sync
plan: 01
subsystem: admin, settings
tags: [drizzle, server-actions, octokit, cron-parser, cronstrue, shadcn-tabs, radix-ui]

# Dependency graph
requires:
  - phase: 01-foundation-and-authentication
    provides: "siteSettings table, getDb pattern, auth/requireAdmin, useActionState form pattern, sonner toasts"
provides:
  - "Settings library (getSetting, setSetting, getSettingsForUI) for reading/writing site_settings"
  - "SETTING_KEYS constants and SECRET_KEYS set for all 13 configuration keys"
  - "Admin settings dashboard at /admin/settings with General, API Keys, AI Prompts tabs"
  - "Test connection API route for GitHub and OpenRouter key validation"
  - "Admin nav links for Settings, Sync, Users"
affects: [02-02-github-sync-engine, 02-03-sync-dashboard, 03-ai-pipeline]

# Tech tracking
tech-stack:
  added: ["@octokit/rest", "cronstrue", "cron-parser"]
  patterns: ["Settings library with secret masking", "Test connection API pattern", "Tabbed admin dashboard"]

key-files:
  created:
    - src/lib/settings/constants.ts
    - src/lib/settings/index.ts
    - src/app/(admin)/admin/settings/page.tsx
    - src/app/(admin)/admin/settings/actions.ts
    - src/app/(admin)/admin/settings/general-settings.tsx
    - src/app/(admin)/admin/settings/api-keys-settings.tsx
    - src/app/(admin)/admin/settings/ai-prompts-settings.tsx
    - src/app/api/admin/settings/test-connection/route.ts
    - src/components/ui/tabs.tsx
    - src/components/ui/textarea.tsx
  modified:
    - src/app/(admin)/layout.tsx
    - src/lib/db/seed.ts
    - package.json

key-decisions:
  - "cron-parser v5 API (CronExpressionParser.parse) for server-side cron validation"
  - "cronstrue for client-side human-readable cron previews (immediate feedback)"
  - "github_branch added as 13th setting key (not in original seed)"
  - "Secret inputs default to MASK_VALUE in form -- skip-save logic prevents overwriting real secrets"

patterns-established:
  - "Settings library: getSetting/setSetting/getSettingsForUI as the single access layer for site_settings"
  - "Secret masking: SECRET_KEYS set + MASK_VALUE constant, never send real values to frontend"
  - "Test connection: POST route pattern for validating external API keys before saving"
  - "Tabbed settings: shadcn Tabs with server component page passing settings to client tab components"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 02 Plan 01: Admin Settings Dashboard Summary

**Key-value settings library with secret masking, tabbed admin dashboard for GitHub/API/AI config, and test-connection route for GitHub and OpenRouter**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T19:17:36Z
- **Completed:** 2026-02-13T19:21:36Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Settings library (getSetting, setSetting, getSettingsForUI) with secret masking via MASK_VALUE
- Server actions for loading/saving all 13 settings with cron validation and mask-skip logic
- Settings dashboard with three tabs: General (repo URL, branch, cron), API Keys (masked inputs, test connections), AI Prompts (four textareas)
- Test connection API route validating GitHub PATs (via Octokit) and OpenRouter keys (via models endpoint)
- Admin nav updated with Settings, Sync, Users links

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings library and server actions** - `36add87` (feat)
2. **Task 2: Settings dashboard UI with tabs and admin nav update** - `978ba59` (feat)

## Files Created/Modified
- `src/lib/settings/constants.ts` - SETTING_KEYS enum, SECRET_KEYS set, MASK_VALUE constant
- `src/lib/settings/index.ts` - getSetting, setSetting, getSettingsForUI helper functions
- `src/app/(admin)/admin/settings/actions.ts` - Server actions: loadSettings, saveGeneralSettings, saveApiKeys, saveAiPrompts
- `src/app/api/admin/settings/test-connection/route.ts` - POST route for testing GitHub and OpenRouter API connections
- `src/app/(admin)/admin/settings/page.tsx` - Settings dashboard with tabbed layout
- `src/app/(admin)/admin/settings/general-settings.tsx` - General settings tab (repo URL, branch, cron schedule)
- `src/app/(admin)/admin/settings/api-keys-settings.tsx` - API keys tab with masked inputs and test buttons
- `src/app/(admin)/admin/settings/ai-prompts-settings.tsx` - AI prompts tab with four textareas
- `src/components/ui/tabs.tsx` - shadcn Tabs component
- `src/components/ui/textarea.tsx` - shadcn Textarea component
- `src/app/(admin)/layout.tsx` - Added Settings and Sync nav links
- `src/lib/db/seed.ts` - Added github_branch setting key
- `package.json` - Added @octokit/rest, cronstrue, cron-parser

## Decisions Made
- Used cron-parser v5 API (CronExpressionParser.parse) for server-side validation -- v5 changed the API from parseExpression to CronExpressionParser.parse
- cronstrue used client-side only for immediate human-readable cron preview feedback
- Added github_branch as 13th setting key (default "main") -- not in original seed.ts but required by plan
- Secret inputs use MASK_VALUE as defaultValue in form fields; saveApiKeys skips any field still equal to MASK_VALUE to avoid overwriting real secrets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added github_branch to seed.ts**
- **Found during:** Task 1 (Settings library)
- **Issue:** Plan specifies github_branch as a new key but seed.ts didn't include it, meaning existing databases would lack the row
- **Fix:** Added github_branch entry to requiredSettings array in seed.ts with default value "main"
- **Files modified:** src/lib/db/seed.ts
- **Verification:** Build passes, constants match seed keys
- **Committed in:** 36add87 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for completeness -- github_branch must exist in seed for new deployments. No scope creep.

## Issues Encountered
- Build initially failed with ENOTEMPTY error on .next/server directory (stale build cache) -- resolved by clearing .next directory and rebuilding

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings library ready for import by Plan 02-02 (GitHub sync engine) and 02-03 (sync dashboard)
- getSetting can retrieve GitHub API key, repo URL, branch for sync operations
- Admin nav already includes Sync link (page will be created in Plan 02-02/02-03)

## Self-Check: PASSED

All 10 created files verified present. Both task commits (36add87, 978ba59) verified in git log.

---
*Phase: 02-admin-settings-and-github-sync*
*Completed: 2026-02-13*
