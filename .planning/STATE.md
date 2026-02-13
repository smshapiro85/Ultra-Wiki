# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** AI-generated wiki articles stay automatically in sync with the codebase while never silently overwriting human contributions
**Current focus:** Phase 1 - Foundation & Authentication

## Current Position

Phase: 1 of 7 (Foundation & Authentication)
Plan: 2 of 3 in current phase
Status: Executing phase
Last activity: 2026-02-13 -- Completed 01-02-PLAN.md (authentication & authorization)

Progress: [██░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5.5min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 11min | 5.5min |

**Recent Trend:**
- Last 5 plans: 5min, 6min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 7 phases derived from 12 requirement categories, consolidating research's 10 phases to fit standard depth
- [Roadmap]: Phase 3 (AI Pipeline) kept standalone due to complexity and risk -- this is the core differentiator
- [Roadmap]: Technical View + Comments combined into one phase (both are article tab sub-features)
- [Roadmap]: Ask AI + Notifications combined (both are interaction layers depending on all prior phases)
- [01-01]: All 18 tables defined upfront in single schema.ts for clean initial migration
- [01-01]: contentJson (jsonb) added to articles/articleVersions now (nullable) to avoid Phase 5 migration
- [01-01]: isSecret boolean defers encryption to Phase 2; marks fields for UI masking
- [01-01]: node:22-alpine Docker base for pg-boss Node 22.12+ requirement
- [01-02]: Lazy NextAuth initialization (factory function) to defer DrizzleAdapter creation until request time
- [01-02]: Lazy db client via Proxy + getDb() for build-time safety without DATABASE_URL
- [01-02]: Admin pages at (admin)/admin/users/ path for /admin/users URL with route group layout
- [01-02]: Server action pattern for signIn/signOut instead of client-side auth calls

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: BlockNote Markdown round-trip is lossy by design -- needs early fidelity validation in Phase 5 with possible Milkdown fallback
- [Research]: pgboss requires direct (unpooled) Neon connection -- must use DATABASE_URL_UNPOOLED, handle connection drops
- [Research]: AI merge quality is the highest-risk feature -- no competitor does this well, needs extensive testing in Phase 3

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 01-02-PLAN.md (authentication & authorization)
Resume file: .planning/phases/01-foundation-and-authentication/01-02-SUMMARY.md
