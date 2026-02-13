---
phase: 01-foundation-and-authentication
plan: 01
subsystem: infra, database
tags: [next.js, drizzle-orm, neon, postgres, docker, tailwind, shadcn-ui, typescript]

# Dependency graph
requires:
  - phase: none
    provides: "First phase, no dependencies"
provides:
  - "Next.js 15 project with App Router, TypeScript, Tailwind v4, shadcn/ui"
  - "Complete Drizzle ORM schema with 18 tables and 6 enums"
  - "Neon Postgres dual connection pattern (HTTP for app, TCP for migrations)"
  - "Docker multi-stage build with standalone output"
  - "Migration infrastructure (drizzle-kit generate/migrate)"
  - "Seed script for 12 site_settings keys"
affects: [01-02, 01-03, 02-01, 02-02, 02-03, 03-01, 03-02, 04-01, 05-01, 06-01, 06-02, 07-01]

# Tech tracking
tech-stack:
  added: [next.js 16.1.6, react 19.2.3, drizzle-orm 0.45.x, drizzle-kit 0.31.x, "@neondatabase/serverless", pg, next-auth@beta, "@auth/drizzle-adapter", zod 4.x, shadcn/ui, tailwindcss 4.x, tsx, radix-ui, lucide-react, class-variance-authority, clsx, tailwind-merge]
  patterns: [standalone-output, dual-neon-connections, drizzle-schema-first, multi-stage-docker, tsvector-search]

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/index.ts
    - src/lib/db/migrate.ts
    - src/lib/db/seed.ts
    - drizzle.config.ts
    - Dockerfile
    - docker-compose.yml
    - .env.example
    - .dockerignore
    - components.json
    - src/lib/utils.ts
  modified:
    - package.json
    - next.config.ts
    - .gitignore
    - tsconfig.json

key-decisions:
  - "All 18 tables defined upfront in single schema.ts for clean initial migration"
  - "contentJson (jsonb) column added to articles and articleVersions now (nullable) to avoid migration later in Phase 5"
  - "isSecret boolean on siteSettings defers encryption to Phase 2 admin settings"
  - "node:22-alpine Docker base for pg-boss Node 22.12+ requirement"

patterns-established:
  - "Neon HTTP for app queries (DATABASE_URL), pg TCP for migrations (DATABASE_URL_UNPOOLED)"
  - "UUID primary keys with defaultRandom() on all tables"
  - "timestamp({ withTimezone: true }) for all date columns"
  - "Self-referencing FKs use (): any => pattern to avoid circular TypeScript errors"
  - "customType for tsvector with generatedAlwaysAs and COALESCE"

# Metrics
duration: 5min
completed: 2026-02-13
---

# Phase 1 Plan 1: Project Scaffold & Database Schema Summary

**Next.js 15 project with 18-table Drizzle schema, dual Neon Postgres connections, Docker multi-stage build, and shadcn/ui initialized**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T17:54:28Z
- **Completed:** 2026-02-13T18:00:00Z
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments
- Scaffolded Next.js 15 (App Router) with TypeScript, Tailwind CSS v4, and shadcn/ui
- Defined complete Drizzle schema: 18 tables, 6 enums, GIN index for full-text search, all foreign keys and constraints
- Created dual database connection infrastructure: Neon HTTP for app, pg TCP for migrations
- Docker multi-stage build producing standalone output, docker-compose with persistent image volume
- Migration SQL generated covering all 18 CREATE TABLE statements with indexes and FKs

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project with all Phase 1 dependencies and Docker infrastructure** - `1b7aa88` (feat)
2. **Task 2: Define complete Drizzle schema with all 14+ tables and create migration infrastructure** - `830e80a` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - Complete Drizzle schema: 18 tables, 6 enums, tsvector custom type
- `src/lib/db/index.ts` - Neon HTTP database client singleton with schema import for relational queries
- `src/lib/db/migrate.ts` - TCP-based migration runner using pg Pool
- `src/lib/db/seed.ts` - Seeds 12 site_settings keys with descriptions and isSecret flags
- `drizzle.config.ts` - Drizzle Kit config pointing to schema and using unpooled URL
- `Dockerfile` - Multi-stage build: deps -> builder -> runner on node:22-alpine
- `docker-compose.yml` - App service with image_data volume mount
- `.env.example` - All required env vars documented (DATABASE_URL, AUTH_*, NEXT_PUBLIC_*)
- `.dockerignore` - Excludes node_modules, .next, .git, .planning, docs, drizzle, .env
- `next.config.ts` - Standalone output enabled
- `package.json` - All Phase 1 deps + db:generate/migrate/seed/studio scripts
- `components.json` - shadcn/ui config (new-york style, Tailwind v4)
- `src/lib/utils.ts` - cn() utility from shadcn/ui
- `.gitignore` - Updated with .env and drizzle exclusions

## Decisions Made
- All 18 tables defined upfront in a single schema.ts file (not incrementally per phase) for a clean initial migration and complete foreign key graph
- Added nullable `contentJson` (jsonb) column to articles and articleVersions now to avoid a Phase 5 migration (per research recommendation)
- Deferred site_settings encryption to Phase 2; `isSecret` boolean column marks sensitive fields for UI masking
- Used `node:22-alpine` as Docker base image (pg-boss 12.x requires Node 22.12+)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `create-next-app` rejects directory names with capital letters (npm naming restriction). Scaffolded in temp directory, copied files back. No impact on result.
- `.next` build cache caused ENOTEMPTY errors between builds. Resolved by cleaning `.next` directory before rebuild.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Project scaffolded and buildable, ready for Plan 01-02 (Auth.js setup with Google OIDC)
- Schema exports all tables and enums needed by auth adapter (users, accounts, sessions, verificationTokens)
- Docker infrastructure in place for deployment testing

## Self-Check: PASSED

All 15 key files verified present. Both task commits (1b7aa88, 830e80a) verified in git log.

---
*Phase: 01-foundation-and-authentication*
*Completed: 2026-02-13*
