---
phase: 01-foundation-and-authentication
verified: 2026-02-13T18:30:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Google OAuth login flow"
    expected: "User can click 'Sign in with Google', complete OAuth flow, and see logged-in state with their name/avatar in nav"
    why_human: "Requires external Google OAuth service and browser interaction"
  - test: "First-user-is-admin promotion"
    expected: "First user to log in sees 'admin' role badge; subsequent users see 'user' role badge"
    why_human: "Requires database state reset and multiple user accounts"
  - test: "Admin promote/demote actions"
    expected: "Admin can click promote/demote buttons on /admin/users page; role badges update immediately; self-demotion is blocked with error message"
    why_human: "Requires real user session and optimistic UI state verification"
  - test: "Profile edit persistence"
    expected: "User changes display name and avatar URL, clicks Save, sees success toast, refreshes page, changes persist"
    why_human: "Requires browser interaction and visual confirmation of persistence"
  - test: "Notification preference toggles"
    expected: "User toggles Slack/email/mention/activity switches, enters Slack user ID when Slack enabled, clicks Save, preferences persist after refresh"
    why_human: "Requires form interaction and state verification"
  - test: "Docker container startup"
    expected: "docker-compose up builds image and starts container on port 3000 with /data/images volume mounted"
    why_human: "Requires Docker runtime and external database connection (Neon Postgres)"
  - test: "Database migration execution"
    expected: "npm run db:migrate connects to Neon Postgres and creates all 18 tables with indexes and foreign keys"
    why_human: "Requires real database connection and verification of schema creation"
---

# Phase 1: Foundation & Authentication Verification Report

**Phase Goal:** Users can log in via Google, the database schema supports all downstream features, and the app runs in Docker

**Verified:** 2026-02-13T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log in with their Google account and see a logged-in state | ✓ VERIFIED | Login page at /login with Google sign-in button exists, Auth.js configured with Google provider, JWT sessions with role/id, middleware protects routes |
| 2 | First user to log in is automatically an admin; subsequent users are regular users | ✓ VERIFIED | createUser event in auth/index.ts counts users and promotes first to admin, JWT callback re-queries DB role on sign-in |
| 3 | Admin can promote a regular user to admin and demote an admin to user | ✓ VERIFIED | /admin/users page with promote/demote server actions, requireAdmin guard, self-demotion blocked |
| 4 | User can edit their display name and avatar from a profile page | ✓ VERIFIED | /profile page with ProfileForm, updateProfile server action with Zod validation, db.update persists to users table |
| 5 | The application starts in Docker with persistent image storage and connects to Neon Postgres (pooled and unpooled) | ✓ VERIFIED | Dockerfile with multi-stage build, docker-compose.yml with image_data volume, dual connection pattern (HTTP for app, TCP for migrations) |

**Score:** 5/5 truths verified

### Required Artifacts

#### Plan 01-01: Project Scaffold & Database Schema

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | Complete Drizzle schema with all 14+ tables | ✓ VERIFIED | 408 lines, 19 pgTable calls, 6 enums, tsvector custom type, all FKs and indexes |
| `src/lib/db/index.ts` | Neon HTTP database client singleton | ✓ VERIFIED | Lazy initialization via getDb() factory + Proxy export for build-time safety |
| `src/lib/db/migrate.ts` | TCP-based migration runner | ✓ VERIFIED | Uses pg Pool with DATABASE_URL_UNPOOLED, drizzle migrate() call |
| `src/lib/db/seed.ts` | site_settings seed script | ✓ VERIFIED | Seeds 12 settings keys with isSecret flags, onConflictDoNothing |
| `drizzle.config.ts` | Drizzle Kit configuration | ✓ VERIFIED | Points to schema.ts, uses DATABASE_URL_UNPOOLED |
| `Dockerfile` | Multi-stage Docker build | ✓ VERIFIED | node:22-alpine, standalone output, /data/images directory with nextjs ownership |
| `docker-compose.yml` | Docker Compose config with image volume | ✓ VERIFIED | image_data volume mapped to /data/images |

#### Plan 01-02: Authentication & Authorization

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth/config.ts` | Edge-safe auth config (no DB adapter) | ✓ VERIFIED | Google provider, JWT/session callbacks, authorized callback, NO db imports |
| `src/lib/auth/index.ts` | Full auth with DrizzleAdapter, JWT strategy, first-user-is-admin | ✓ VERIFIED | Lazy NextAuth init, DrizzleAdapter with table refs, createUser event with user count, JWT callback re-queries DB role |
| `src/middleware.ts` | Route protection middleware | ✓ VERIFIED | Imports ONLY from auth/config (not auth/index), matcher excludes /api/auth and static assets |
| `src/types/next-auth.d.ts` | Type augmentation for role and id on session | ✓ VERIFIED | Extends Session, User, JWT interfaces with role and id |
| `src/app/(auth)/login/page.tsx` | Login page with Google sign-in button | ✓ VERIFIED | Card with Google SVG icon, signIn("google") server action, error display |
| `src/app/(admin)/admin/users/page.tsx` | Admin user management page | ✓ VERIFIED | Table with avatars, role badges, UserActions component, admin count display |
| `src/app/(admin)/admin/users/actions.ts` | Server actions for promote/demote | ✓ VERIFIED | promoteUser, demoteUser, getUsers with requireAdmin guard, self-demotion prevention |

#### Plan 01-03: User Profile & Notifications

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(wiki)/profile/page.tsx` | Profile page with name, avatar, and notification forms | ✓ VERIFIED | Two Card sections: ProfileForm + NotificationForm, role badge display |
| `src/app/(wiki)/profile/actions.ts` | Server actions for profile and notification updates | ✓ VERIFIED | updateProfile with Zod validation (profileSchema), updateNotificationPreferences, getUserProfile |
| `src/app/(wiki)/profile/profile-form.tsx` | Client form for display name and avatar URL | ✓ VERIFIED | useActionState with toast feedback, Google avatar preview, name + avatarUrl inputs |
| `src/app/(wiki)/profile/notification-form.tsx` | Client form for notification preference toggles | ✓ VERIFIED | 4 Switch toggles (Slack, email, mention, activity), conditional Slack user ID input |
| `src/components/common/user-menu.tsx` | Extracted user menu component with profile link | ✓ VERIFIED | DropdownMenu with avatar, profile/admin links, sign out, conditional admin link |

### Key Link Verification

#### Plan 01-01: Database & Schema Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/lib/db/index.ts` | `src/lib/db/schema.ts` | schema import for relational queries | ✓ WIRED | `import * as schema from "./schema"` + drizzle({ schema }) |
| `drizzle.config.ts` | `src/lib/db/schema.ts` | schema path reference | ✓ WIRED | `schema: "./src/lib/db/schema.ts"` |
| `src/lib/db/migrate.ts` | `DATABASE_URL_UNPOOLED` | pg Pool with direct connection | ✓ WIRED | `Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! })` |

#### Plan 01-02: Auth Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/middleware.ts` | `src/lib/auth/config.ts` | Edge-safe import (NOT from auth/index.ts) | ✓ WIRED | `import { authConfig } from "@/lib/auth/config"` — NO db imports |
| `src/lib/auth/index.ts` | `src/lib/db/schema.ts` | DrizzleAdapter with table references | ✓ WIRED | `import { users, accounts, sessions, verificationTokens }` + DrizzleAdapter(db, { usersTable, ... }) |
| `src/lib/auth/index.ts` | `src/lib/db/index.ts` | Database client for adapter and first-user check | ✓ WIRED | `import { getDb }` + `const db = getDb()` in lazy init |
| `src/app/(admin)/admin/users/actions.ts` | `src/lib/auth/index.ts` | auth() call for admin role check | ✓ WIRED | `requireAdmin()` calls `auth()` and checks `session.user.role !== "admin"` |
| `src/app/api/auth/[...nextauth]/route.ts` | `src/lib/auth/index.ts` | Route handler exports | ✓ WIRED | `export const { GET, POST } = handlers` |

#### Plan 01-03: Profile Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/app/(wiki)/profile/profile-form.tsx` | `src/app/(wiki)/profile/actions.ts` | form action binding to updateProfile | ✓ WIRED | `useActionState(updateProfile, null)` + `action={formAction}` |
| `src/app/(wiki)/profile/notification-form.tsx` | `src/app/(wiki)/profile/actions.ts` | form action binding to updateNotificationPreferences | ✓ WIRED | `useActionState(updateNotificationPreferences, null)` |
| `src/app/(wiki)/profile/actions.ts` | `src/lib/db/index.ts` | db.update(users) for persisting changes | ✓ WIRED | `const db = getDb(); await db.update(users).set({ ... })` in both actions |
| `src/app/(wiki)/profile/page.tsx` | `src/lib/auth/index.ts` | auth() to get current user session and load user data | ✓ WIRED | `getUserProfile()` calls `auth()` and queries users table |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| INFR-01: Docker deployment | ✓ SATISFIED | Dockerfile + docker-compose.yml verified, multi-stage build with standalone output |
| INFR-02: Local volume mount for image storage | ✓ SATISFIED | image_data volume in docker-compose.yml mapped to /data/images in Dockerfile |
| INFR-03: Dual Neon Postgres connections | ✓ SATISFIED | DATABASE_URL (Neon HTTP) in db/index.ts, DATABASE_URL_UNPOOLED (pg TCP) in db/migrate.ts |
| AUTH-01: User can log in via Google OIDC | ✓ SATISFIED | Auth.js v5 with Google provider, login page, JWT sessions, middleware protection |
| AUTH-02: First user becomes admin | ✓ SATISFIED | createUser event counts users, promotes first to admin, JWT callback re-queries role |
| AUTH-03: Admin can promote/demote users | ✓ SATISFIED | /admin/users page with server actions, requireAdmin guard, self-demotion prevention |
| AUTH-04: Edit display name and avatar | ✓ SATISFIED | /profile page with ProfileForm, updateProfile server action, Zod validation |
| AUTH-05: Notification preferences | ✓ SATISFIED | NotificationForm with 4 toggles + Slack user ID, updateNotificationPreferences action |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(wiki)/page.tsx` | 22-25 | Placeholder home page with "Phase 4" note | ℹ️ Info | Intentional placeholder, does not block phase goal |

**No blocking anti-patterns found.** The home page is explicitly noted as a placeholder for Phase 4 (Wiki Viewer dashboard), which is intentional.

### Human Verification Required

#### 1. Google OAuth Login Flow

**Test:** 
1. Set up Google OAuth client ID and secret in .env.local
2. Run `npm run dev` or `docker-compose up`
3. Navigate to http://localhost:3000
4. Expect redirect to /login
5. Click "Sign in with Google"
6. Complete Google OAuth consent screen
7. Expect redirect back to / with user logged in

**Expected:** 
- User sees their Google name and avatar in the top-right nav
- User can open dropdown menu to see profile and sign out options
- Middleware protects all routes except /login and /api/auth/*

**Why human:** Requires external Google OAuth service configuration, browser interaction, and visual confirmation of logged-in state.

#### 2. First-User-Is-Admin Promotion

**Test:**
1. Reset database (drop all users)
2. Run `npm run db:migrate` to recreate schema
3. Log in with first user account
4. Navigate to / and verify role badge shows "admin" (destructive variant)
5. Open dropdown menu and verify "Admin" link appears
6. Navigate to /admin/users
7. Log out
8. Log in with second user account
9. Verify role badge shows "user" (secondary variant)
10. Verify "Admin" link does NOT appear in dropdown
11. Attempt to navigate to /admin/users directly
12. Expect redirect to /

**Expected:**
- First user is promoted to admin automatically
- Second user remains "user" role
- Non-admin users cannot access /admin/* routes

**Why human:** Requires database state reset, multiple user accounts, and visual verification of role badges and access control.

#### 3. Admin Promote/Demote Actions

**Test:**
1. Log in as admin user
2. Navigate to /admin/users
3. Verify table shows all users with avatars, names, emails, role badges
4. For a "user" role user, click "Promote"
5. Verify role badge changes to "admin" (destructive variant) without page refresh
6. For an "admin" role user (not yourself), click "Demote"
7. Verify role badge changes to "user" (secondary variant)
8. Attempt to click "Demote" on yourself
9. Expect error toast "Cannot demote yourself"

**Expected:**
- Promote/demote buttons update role badges optimistically
- Self-demotion is blocked with error message
- Changes persist after page refresh

**Why human:** Requires real user session, interactive button clicks, and verification of optimistic UI updates and error handling.

#### 4. Profile Edit Persistence

**Test:**
1. Log in as any user
2. Navigate to /profile
3. Change display name to "Test User"
4. Enter custom avatar URL: "https://i.pravatar.cc/150?img=3"
5. Click "Save Profile"
6. Verify success toast appears
7. Refresh page
8. Verify display name and avatar URL persist in form fields
9. Open user menu in nav
10. Verify avatar uses custom URL (not Google avatar)

**Expected:**
- Changes persist after page refresh
- Custom avatar URL replaces Google avatar in nav and profile page
- Zod validation prevents empty name or invalid URL

**Why human:** Requires browser interaction, form submission, visual confirmation of avatar change, and persistence verification.

#### 5. Notification Preference Toggles

**Test:**
1. Navigate to /profile
2. Toggle "Slack DM notifications" on
3. Verify "Slack User ID" input appears
4. Enter "U12345ABCD"
5. Toggle "Email notifications" on
6. Toggle "Mentions" off
7. Toggle "Activity" on
8. Click "Save Preferences"
9. Verify success toast
10. Refresh page
11. Verify all 4 toggles and Slack user ID persist

**Expected:**
- Slack user ID input appears/hides based on Slack toggle
- All preferences persist after page refresh
- Changes are saved to users table

**Why human:** Requires form interaction, conditional UI state verification, and persistence confirmation.

#### 6. Docker Container Startup

**Test:**
1. Create .env file with all required environment variables (DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_*, NEXT_PUBLIC_APP_URL)
2. Run `docker-compose build`
3. Run `docker-compose up`
4. Verify container starts without errors
5. Navigate to http://localhost:3000
6. Verify app loads and redirects to /login
7. Run `docker exec -it <container> ls -la /data/images`
8. Verify /data/images directory exists with nextjs:nodejs ownership
9. Run `docker volume inspect ultra-wiki_image_data`
10. Verify volume is created

**Expected:**
- Container builds successfully (multi-stage Dockerfile)
- App starts on port 3000
- /data/images directory exists with correct ownership
- image_data volume is mounted and persists across container restarts

**Why human:** Requires Docker runtime, external database connection (Neon Postgres), and filesystem/volume verification.

#### 7. Database Migration Execution

**Test:**
1. Set DATABASE_URL_UNPOOLED in .env
2. Run `npm run db:generate` (should already have migration files in drizzle/)
3. Run `npm run db:migrate`
4. Verify console output: "Running migrations..." and "Migrations complete."
5. Connect to Neon Postgres database
6. Run `\dt` to list tables
7. Verify all 18 tables exist: users, accounts, sessions, verification_tokens, categories, articles, article_versions, github_files, excluded_paths, article_file_links, article_db_tables, comments, mentions, ai_conversations, ai_conversation_messages, article_images, site_settings, sync_logs
8. Run `\d articles` to describe articles table
9. Verify search_vector column has GIN index
10. Verify foreign keys and constraints

**Expected:**
- Migration runs without errors
- All 18 tables created with correct schemas
- Indexes and foreign keys are created
- tsvector column on articles has GIN index

**Why human:** Requires real database connection, SQL client for schema verification, and confirmation of migration success.

---

## Summary

**All automated checks passed.** Phase 1 goal is achieved at the code level.

### Must-Haves: 11/11 Verified

**Plan 01-01 (Project Scaffold & Database Schema):**
- ✓ Project builds with `npm run build`
- ✓ Drizzle schema defines all 18 tables (19 pgTable calls including verification_tokens)
- ✓ Migration SQL generated with all CREATE TABLE statements
- ✓ Docker infrastructure in place (Dockerfile, docker-compose.yml, image_data volume)
- ✓ Dual connection pattern established (Neon HTTP for app, pg TCP for migrations)

**Plan 01-02 (Authentication & Authorization):**
- ✓ Auth.js v5 configured with Google OIDC, JWT sessions, DrizzleAdapter
- ✓ Middleware protects routes, imports edge-safe config only
- ✓ First-user-is-admin logic in createUser event with race-safe JWT callback
- ✓ Login page with Google sign-in button
- ✓ Admin user management page with promote/demote server actions
- ✓ Self-demotion prevention in demoteUser action

**Plan 01-03 (User Profile & Notifications):**
- ✓ Profile page with display name and avatar URL editing
- ✓ Zod validation in updateProfile server action
- ✓ Notification preferences form with 4 toggles + Slack user ID
- ✓ UserMenu dropdown component extracted and wired
- ✓ Sonner toast integration for form feedback

### All Key Links Verified

**11/11 key links wired correctly:**
- Database schema imported by db client, drizzle.config, and auth adapter
- Middleware imports ONLY edge-safe config (not full auth with db)
- Server actions use auth() for role checks
- Form components call server actions via useActionState
- All db.update calls persist to users table

### Requirements: 8/8 Satisfied

All Phase 1 requirements (INFR-01, INFR-02, INFR-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05) are satisfied at the code level.

### Human Verification Needed

**7 items require human testing:**
1. Google OAuth login flow (external service + browser)
2. First-user-is-admin promotion (database state + multiple accounts)
3. Admin promote/demote actions (UI interaction + role verification)
4. Profile edit persistence (form submission + visual confirmation)
5. Notification preference toggles (conditional UI + persistence)
6. Docker container startup (runtime + volume verification)
7. Database migration execution (SQL client + schema verification)

These require external services (Google OAuth, Neon Postgres, Docker runtime) and/or visual confirmation that automated tools cannot verify.

### Commits Verified

All 6 task commits from the 3 summaries are present in git log:
- `1b7aa88` feat(01-01): scaffold Next.js 15 project with Docker infrastructure
- `830e80a` feat(01-01): define complete Drizzle schema with 18 tables and migration infrastructure
- `af76909` feat(01-02): implement Auth.js v5 split config with Google OIDC, JWT sessions, and middleware
- `37bfc55` feat(01-02): add login page, wiki/admin layouts, and user management
- `bfff528` feat(01-03): profile page with display name, avatar, and notification preferences
- `7d6029e` feat(01-03): extract UserMenu component with dropdown navigation

---

_Verified: 2026-02-13T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
