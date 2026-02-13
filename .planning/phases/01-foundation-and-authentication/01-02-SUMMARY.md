---
phase: 01-foundation-and-authentication
plan: 02
subsystem: auth
tags: [next-auth, google-oidc, jwt, drizzle-adapter, middleware, role-based-access, shadcn-ui]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Drizzle schema with users/accounts/sessions/verificationTokens tables, db client"
provides:
  - "Auth.js v5 with Google OIDC, JWT sessions, DrizzleAdapter"
  - "Edge-safe middleware protecting all routes except /login and /api/auth/*"
  - "First-user-is-admin logic with race-condition-safe JWT callback"
  - "Login page with Google sign-in button"
  - "Admin user management page with promote/demote actions"
  - "Route group layouts: (auth), (wiki), (admin)"
  - "Session provider wrapping root layout"
  - "Type augmentation for session.user.role and session.user.id"
affects: [01-03, 02-01, 02-02, 02-03, 03-01, 04-01, 05-01, 06-01, 07-01]

# Tech tracking
tech-stack:
  added: [next-auth 5.0.0-beta.30, "@auth/drizzle-adapter"]
  patterns: [auth-split-config, lazy-db-initialization, lazy-nextauth-initialization, route-groups, server-actions-with-auth-guard]

key-files:
  created:
    - src/lib/auth/config.ts
    - src/lib/auth/index.ts
    - src/middleware.ts
    - src/types/next-auth.d.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/components/common/session-provider.tsx
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(wiki)/layout.tsx
    - src/app/(wiki)/page.tsx
    - src/app/(admin)/layout.tsx
    - src/app/(admin)/admin/users/actions.ts
    - src/app/(admin)/admin/users/page.tsx
    - src/app/(admin)/admin/users/user-actions.tsx
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/table.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/avatar.tsx
  modified:
    - src/app/layout.tsx
    - src/lib/db/index.ts

key-decisions:
  - "Lazy NextAuth initialization (factory function) to defer DrizzleAdapter creation until request time, avoiding build-time DATABASE_URL requirement"
  - "Lazy db client via Proxy + getDb() to prevent module-level neon() instantiation during static page collection"
  - "Admin pages at (admin)/admin/users/ path to produce /admin/users URL while using route group for shared layout"
  - "Server action pattern for login (signIn) and sign-out (signOut) instead of client-side useSession"

patterns-established:
  - "Auth split config: config.ts (edge-safe, no DB) + index.ts (full auth with DrizzleAdapter)"
  - "Lazy initialization: getDb() factory for build-time safety, Proxy export for drop-in API compatibility"
  - "Server action auth guard: requireAdmin() helper checks session.user.role before any mutation"
  - "Route groups: (auth) for unauthenticated pages, (wiki) for authenticated pages, (admin) for admin-only pages"
  - "Client component for interactive buttons (user-actions.tsx) with useTransition for optimistic UX"

# Metrics
duration: 6min
completed: 2026-02-13
---

# Phase 1 Plan 2: Authentication & Authorization Summary

**Auth.js v5 with Google OIDC, JWT sessions with role claim, edge-safe middleware, first-user-is-admin logic, login page, and admin user management with promote/demote**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-13T18:02:49Z
- **Completed:** 2026-02-13T18:08:41Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Complete Auth.js v5 setup with split config pattern (edge-safe config + Node.js full auth with DrizzleAdapter)
- Google OIDC provider with JWT sessions carrying user role and id
- First-user-is-admin event handler with race-condition-safe JWT callback that re-queries DB on sign-in
- Middleware protecting all routes except /login and /api/auth/*
- Login page with Google sign-in button, error display
- Wiki layout with nav bar, user avatar, admin link, sign-out
- Admin user management page with table, promote/demote server actions, self-demotion prevention

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth.js v5 split config with Google OIDC, JWT sessions, middleware, and type augmentation** - `af76909` (feat)
2. **Task 2: Login page, admin user management, and route group layouts** - `37bfc55` (feat)

## Files Created/Modified
- `src/lib/auth/config.ts` - Edge-safe auth config with Google provider, JWT/session callbacks, authorized callback
- `src/lib/auth/index.ts` - Full auth with DrizzleAdapter, lazy init, first-user-is-admin event, DB role query in JWT callback
- `src/middleware.ts` - Edge middleware importing only from auth/config (not auth/index)
- `src/types/next-auth.d.ts` - Type augmentation adding role/id to Session, User, and JWT
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth route handler
- `src/components/common/session-provider.tsx` - Client component wrapping SessionProvider
- `src/app/layout.tsx` - Updated to wrap children with AuthSessionProvider, updated metadata
- `src/lib/db/index.ts` - Added lazy initialization via getDb() factory + Proxy export
- `src/app/(auth)/layout.tsx` - Centered layout for auth pages
- `src/app/(auth)/login/page.tsx` - Login page with Google sign-in button and error handling
- `src/app/(wiki)/layout.tsx` - Authenticated wiki layout with nav, avatar, admin link, sign-out
- `src/app/(wiki)/page.tsx` - Placeholder home page showing user name and role
- `src/app/(admin)/layout.tsx` - Admin layout with role guard, admin nav
- `src/app/(admin)/admin/users/actions.ts` - Server actions: promoteUser, demoteUser, getUsers with admin guard
- `src/app/(admin)/admin/users/page.tsx` - Admin table with user list, role badges, action buttons
- `src/app/(admin)/admin/users/user-actions.tsx` - Client component for promote/demote buttons with useTransition
- `src/components/ui/button.tsx` - shadcn/ui Button component
- `src/components/ui/card.tsx` - shadcn/ui Card component
- `src/components/ui/table.tsx` - shadcn/ui Table component
- `src/components/ui/badge.tsx` - shadcn/ui Badge component
- `src/components/ui/avatar.tsx` - shadcn/ui Avatar component

## Decisions Made
- **Lazy NextAuth initialization:** Used factory function pattern `NextAuth(() => { ... })` to defer DrizzleAdapter creation until request time. This prevents build failures when DATABASE_URL is not set during `next build` static page collection.
- **Lazy db client:** Changed db/index.ts from eager `neon()` instantiation to `getDb()` factory with Proxy export. The Proxy maintains API compatibility so existing imports (`import { db }`) work unchanged, while deferring actual connection creation to first use.
- **Admin route path:** Used `(admin)/admin/users/` directory structure so the route group `(admin)` provides a shared admin layout while the nested `admin/` directory produces the `/admin/users` URL path.
- **Server action auth pattern:** All mutations (promote/demote) use `requireAdmin()` helper that checks `session.user.role`. The login and sign-out use inline server actions with `signIn()`/`signOut()` from `@/lib/auth`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy database initialization for build-time compatibility**
- **Found during:** Task 1 (Auth config + build verification)
- **Issue:** `neon(process.env.DATABASE_URL!)` in db/index.ts fails at module evaluation during `next build` because DATABASE_URL is not set during static page collection
- **Fix:** Replaced eager neon() call with lazy `getDb()` factory function + Proxy export for API compatibility
- **Files modified:** src/lib/db/index.ts
- **Verification:** `npm run build` succeeds without DATABASE_URL set
- **Committed in:** af76909 (Task 1 commit)

**2. [Rule 3 - Blocking] Lazy NextAuth initialization for DrizzleAdapter**
- **Found during:** Task 1 (Build failed even after lazy db -- DrizzleAdapter type-checks its db argument at module time)
- **Issue:** DrizzleAdapter(db) receives a Proxy object at module evaluation time, which fails the adapter's database type check ("Unsupported database type (object)")
- **Fix:** Used NextAuth lazy initialization pattern `NextAuth(() => { const db = getDb(); return { adapter: DrizzleAdapter(db), ... } })` which defers all initialization to request time
- **Files modified:** src/lib/auth/index.ts
- **Verification:** `npm run build` succeeds, route handler correctly listed as dynamic
- **Committed in:** af76909 (Task 1 commit)

**3. [Rule 1 - Bug] Admin route path correction**
- **Found during:** Task 2 (Build verification)
- **Issue:** Route group `(admin)/users/page.tsx` mapped to `/users` instead of `/admin/users` because route groups strip their name from the URL
- **Fix:** Restructured to `(admin)/admin/users/page.tsx` so the `admin` path segment is preserved in the URL
- **Files modified:** src/app/(admin)/admin/users/ (moved from src/app/(admin)/users/)
- **Verification:** `npm run build` shows `/admin/users` in route table
- **Committed in:** 37bfc55 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correct build and URL routing. No scope creep.

## Issues Encountered
- Next.js 16.1.6 shows deprecation warning for "middleware" file convention, suggesting "proxy" instead. The middleware still works correctly. This may need attention in a future phase if Next.js removes middleware support.

## User Setup Required

**External services require manual configuration before authentication will work.**

The following environment variables must be set in `.env.local`:

| Variable | Source |
|----------|--------|
| `AUTH_GOOGLE_ID` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client Secret |
| `AUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `DATABASE_URL` | Neon Console -> Connection Details -> Pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon Console -> Connection Details -> Direct connection string |

Google OAuth setup:
1. Create OAuth 2.0 Client ID (Web application type) in Google Cloud Console
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

## Next Phase Readiness
- Auth foundation complete: Google OIDC login, JWT sessions with role, route protection
- Admin user management ready: promote/demote with server actions
- All route groups established: (auth), (wiki), (admin)
- Ready for Plan 01-03 (likely profile or additional settings)
- The `(wiki)` layout provides the authenticated shell for all feature pages in Phases 2-7

## Self-Check: PASSED

All 21 key files verified present. Both task commits (af76909, 37bfc55) verified in git log.

---
*Phase: 01-foundation-and-authentication*
*Completed: 2026-02-13*
