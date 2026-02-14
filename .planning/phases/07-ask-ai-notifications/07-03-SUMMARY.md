---
phase: 07-ask-ai-notifications
plan: 03
subsystem: notifications
tags: [slack, sendgrid, email, notifications, fire-and-forget, rest-api]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: users table with notification preference columns, site_settings table
  - phase: 06-technical-view-comments-mentions
    provides: comments route with @mention extraction, mentions table
  - phase: 03-ai-pipeline
    provides: AI pipeline (pipeline.ts) and conflict resolver (conflict.ts)
provides:
  - Slack DM notification delivery via REST API
  - SendGrid email notification delivery via REST API
  - Notification message templates for mention, newComment, aiSyncUpdate, aiConflict
  - Preference-checking notification dispatcher (fire-and-forget, never blocks)
  - Test notification admin API endpoint for Slack and SendGrid validation
  - Admin UI test buttons for Slack bot token and SendGrid API key
  - Notification triggers wired into comments, AI pipeline, and conflict resolver
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget notification pattern: Promise.catch() for non-blocking delivery"
    - "Dynamic import for notifications in pipeline/conflict to avoid circular deps"
    - "TestNotificationButton with getPayload callback for flexible test forms"
    - "deliverToUser helper with Promise.allSettled for parallel Slack + email"

key-files:
  created:
    - src/lib/notifications/slack.ts
    - src/lib/notifications/email.ts
    - src/lib/notifications/templates.ts
    - src/lib/notifications/service.ts
    - src/app/api/admin/settings/test-notification/route.ts
  modified:
    - src/app/(admin)/admin/settings/api-keys-settings.tsx
    - src/app/api/articles/[id]/comments/route.ts
    - src/lib/ai/pipeline.ts
    - src/lib/merge/conflict.ts

key-decisions:
  - "No new npm dependencies for Slack/SendGrid -- raw fetch() against REST APIs (one call each)"
  - "Dynamic import() for notification service in pipeline.ts and conflict.ts to match existing pattern"
  - "Notification triggers are fire-and-forget -- never block primary actions (comment post, sync, merge)"

patterns-established:
  - "Notification delivery: try/catch wrapper at top level, Promise.allSettled for parallel channels"
  - "TestNotificationButton component with getPayload callback for type-safe test form submission"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 7 Plan 3: Notifications Summary

**Slack DM and SendGrid email notification service with preference-based routing, admin test buttons, and four notification trigger points wired into comments, AI pipeline, and conflict resolver**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T16:09:22Z
- **Completed:** 2026-02-14T16:13:55Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Notification library with Slack DM (chat.postMessage), SendGrid email (v3/mail/send), templates for 4 event types, and preference-checking service dispatcher
- Admin test buttons for Slack bot token validation (auth.test) and SendGrid test email delivery
- All four notification triggers wired: @mention in comments, new comment on article, AI sync update on human-edited article, AI merge conflict

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification library (Slack, email, templates, service dispatcher)** - `7bab0a0` (feat)
2. **Task 2: Test notification endpoint, admin UI test buttons, and wire all notification triggers** - `fa2b99a` (feat)

## Files Created/Modified
- `src/lib/notifications/slack.ts` - sendSlackDM via Slack chat.postMessage REST API
- `src/lib/notifications/email.ts` - sendEmail via SendGrid v3/mail/send REST API
- `src/lib/notifications/templates.ts` - Slack text, email subject, HTML body for mention/newComment/aiSyncUpdate/aiConflict
- `src/lib/notifications/service.ts` - notifyMention, notifyNewComment, notifyAiSyncUpdate, notifyAiConflict with preference checking
- `src/app/api/admin/settings/test-notification/route.ts` - POST endpoint for testing Slack/SendGrid configuration
- `src/app/(admin)/admin/settings/api-keys-settings.tsx` - Added TestNotificationButton, Slack test button, SendGrid test button with recipient input
- `src/app/api/articles/[id]/comments/route.ts` - Added fire-and-forget notifyMention + notifyNewComment triggers
- `src/lib/ai/pipeline.ts` - Added fire-and-forget notifyAiSyncUpdate after human-edited article update
- `src/lib/merge/conflict.ts` - Added fire-and-forget notifyAiConflict when needsReview set

## Decisions Made
- No new npm dependencies for Slack/SendGrid -- raw fetch() against REST APIs keeps bundle small (one POST call each)
- Dynamic import() for notification service in pipeline.ts and conflict.ts matches existing pattern for build-time safety
- Notification triggers are fire-and-forget via Promise.catch() -- never block primary actions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in src/components/chat/ask-ai-panel.tsx (from plans 07-01/07-02) causes `npm run build` to fail at type-checking stage. This is unrelated to notifications code. Verified via `tsc --noEmit` filtering that all notification-related files compile cleanly.

## User Setup Required

**External services require manual configuration.** The plan's `user_setup` section documents:
- **Slack:** Create a Slack App with Bot Token (`chat:write` scope) at https://api.slack.com/apps
- **SendGrid:** Create SendGrid account and API key (Mail Send permission) with verified sender email

Both can be configured and tested from the Admin Settings page using the new test buttons.

## Next Phase Readiness
- Notification infrastructure complete and wired to all trigger points
- Admin can validate Slack/SendGrid configuration before enabling for users
- Users can control notifications via their profile preferences (notifySlackEnabled, notifyEmailEnabled, notifyOnMention, notifyOnActivity)

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (7bab0a0, fa2b99a) verified in git log.

---
*Phase: 07-ask-ai-notifications*
*Completed: 2026-02-14*
