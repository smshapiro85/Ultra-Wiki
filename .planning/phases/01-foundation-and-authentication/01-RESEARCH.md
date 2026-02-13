# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-02-13
**Domain:** Next.js 15 project setup, Drizzle ORM schema with Neon Postgres, NextAuth v5 Google OIDC, Docker deployment
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire project foundation: scaffolding Next.js 15 with App Router, defining the complete database schema (all 14+ tables) in Drizzle ORM, setting up NextAuth v5 with Google OIDC and role-based access, and containerizing with Docker. This phase is dependency-free and everything downstream builds on it.

The technologies are well-documented and stable. Next.js 15, Drizzle ORM, and shadcn/ui are mature choices. NextAuth v5 (Auth.js) remains in "beta" but is the only Auth.js version compatible with Next.js 15 App Router and is widely deployed in production. The main complexity lies in: (1) getting the Drizzle schema right the first time since all 7 phases depend on it, (2) the Auth.js split config pattern for edge/node compatibility, and (3) the dual Neon connection strategy (HTTP for app queries, direct TCP for pgboss later).

**Primary recommendation:** Define ALL tables in the Drizzle schema up front (not just Phase 1 tables), use the Auth.js split config pattern (`auth.config.ts` + `auth.ts`) from day one, and use JWT session strategy with the `role` field persisted in the token. The Docker setup should use Next.js standalone output mode with a multi-stage build targeting `node:22-alpine`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Full-stack React framework | Stable LTS, Turbopack, App Router mature. React 19 included. |
| React | 19.x | UI library | Ships with Next.js 15. Required. |
| TypeScript | 5.x | Type safety | Non-negotiable for Drizzle inference and Auth.js types. |
| Drizzle ORM | 0.45.x | Type-safe ORM | Lightweight, SQL-like API, first-class Neon + Postgres support. |
| drizzle-kit | latest | Migrations CLI | `generate` for SQL files, `migrate` for applying them. |
| @neondatabase/serverless | latest | Neon HTTP driver | Fast stateless queries for app routes and RSC. |
| pg (node-postgres) | latest | Direct TCP driver | Required for pgboss (Phase 2) and migration scripts. Install now. |
| next-auth | 5.x (@beta) | Authentication | Only auth solution for Next.js 15 App Router. Install via `next-auth@beta`. |
| @auth/drizzle-adapter | latest | Auth.js DB adapter | Official adapter mapping Auth.js tables to Drizzle schema. |
| shadcn/ui | latest (CLI) | Component library | Copies components into project. Supports Tailwind v4, unified Radix UI. |
| Tailwind CSS | 4.x | Utility CSS | CSS-first config, new engine. shadcn/ui fully supports v4. |

### Supporting (install now, used in later phases)

| Library | Version | Purpose | When Used |
|---------|---------|---------|-----------|
| pg-boss | 12.x | Job queue | Phase 2 (GitHub sync). Install in Phase 2 but schema awareness needed now. |
| zod | latest | Schema validation | Used throughout for form validation, API request validation. |

### Phase 1 Installation

```bash
# Scaffold project
npx create-next-app@latest ultra-wiki --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Initialize shadcn/ui
npx shadcn@latest init

# Database
npm install drizzle-orm @neondatabase/serverless pg
npm install -D drizzle-kit @types/pg

# Auth
npm install next-auth@beta @auth/drizzle-adapter

# Validation
npm install zod
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
src/
├── app/
│   ├── (auth)/                    # Route group: login page
│   │   ├── login/page.tsx
│   │   └── layout.tsx             # Minimal layout (no sidebar)
│   ├── (wiki)/                    # Route group: authenticated pages
│   │   ├── layout.tsx             # Shell with nav (minimal for now)
│   │   ├── page.tsx               # Placeholder home
│   │   └── profile/page.tsx       # User profile editing
│   ├── (admin)/                   # Route group: admin pages
│   │   ├── layout.tsx             # Admin shell
│   │   └── users/page.tsx         # User management (promote/demote)
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts           # Auth.js route handler
│   │   └── users/
│   │       └── route.ts           # User management API
│   └── layout.tsx                 # Root layout (SessionProvider)
├── components/
│   ├── ui/                        # shadcn/ui components
│   └── common/                    # Nav, sidebar shell, user menu
├── lib/
│   ├── auth/
│   │   ├── config.ts              # auth.config.ts (edge-safe, no adapter)
│   │   └── index.ts               # Full auth with DrizzleAdapter + JWT
│   ├── db/
│   │   ├── schema.ts              # ALL Drizzle table definitions
│   │   ├── index.ts               # DB client singleton (Neon HTTP)
│   │   ├── migrate.ts             # Migration runner script
│   │   └── seed.ts                # Seed site_settings keys
│   └── utils/
│       └── cn.ts                  # shadcn class merge utility
├── middleware.ts                   # Auth middleware (imports from auth/config.ts)
├── instrumentation.ts             # Placeholder for pgboss (Phase 2)
└── types/
    └── next-auth.d.ts             # Type augmentation for role on session
```

### Pattern 1: Auth.js Split Config (Edge/Node Compatibility)

**What:** Separate auth configuration into two files to handle the edge/node runtime split. Middleware runs on edge (no DB access). Server components and API routes run on Node.js (full DB access).

**When to use:** Always with NextAuth v5 + database adapter + Next.js middleware.

**Why:** The DrizzleAdapter requires Node.js TCP connections. Middleware runs in edge runtime. If you import the adapter in middleware, the build fails. The split pattern avoids this.

**Example:**

```typescript
// src/lib/auth/config.ts -- Edge-safe, NO adapter
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      if (isOnLogin) return true; // Allow login page access
      if (!isLoggedIn) return false; // Redirect to login
      return true;
    },
    jwt({ token, user }) {
      // Persist role in JWT on sign-in
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      // Expose role + id on session object
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

// src/lib/auth/index.ts -- Full auth with adapter (Node.js only)
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import authConfig from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Override jwt callback to include first-user-is-admin logic
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

// src/middleware.ts -- Edge-safe, imports only config
import NextAuth from "next-auth";
import authConfig from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

**Source:** [Auth.js Edge Compatibility Guide](https://authjs.dev/guides/edge-compatibility), [Auth.js Next.js Reference](https://authjs.dev/reference/nextjs)

### Pattern 2: Dual Neon Database Connections

**What:** Use two different connection drivers for different purposes. The Neon HTTP driver (`@neondatabase/serverless`) for fast, stateless app queries. The `pg` (node-postgres) driver for migration scripts and pgboss (Phase 2).

**When to use:** Always in this project. Set up both connection strings from Phase 1.

**Example:**

```typescript
// src/lib/db/index.ts -- Application queries (HTTP, fast, stateless)
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });

// src/lib/db/migrate.ts -- Migration script (TCP, persistent)
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED!,
});
const db = drizzle({ client: pool });

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}
main();
```

**Environment variables:**
```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Source:** [Drizzle + Neon docs](https://orm.drizzle.team/docs/connect-neon), [Neon connection types](https://neon.com/docs/connect/choose-connection)

### Pattern 3: Drizzle Schema with Auth.js Tables + App Tables

**What:** Define all database tables in a single `schema.ts` file (or split by domain). The Auth.js tables (users, accounts, sessions, verificationTokens) must match the DrizzleAdapter's expectations. App tables extend beyond these.

**Critical details:**
- Auth.js expects specific column names on its tables. Pass custom tables to DrizzleAdapter via `usersTable`, `accountsTable`, etc.
- The `users` table can have extra columns (like `role`, notification preferences) beyond what Auth.js requires.
- Use `pgEnum` for enum columns (`role`, `change_source`, etc.).
- Use `uuid().defaultRandom()` for primary keys (spec uses UUID PKs).
- Use `customType` for `tsvector` column.
- Use `timestamp({ withTimezone: true })` for all timestamps (spec uses `timestamptz`).
- Use `.generatedAlwaysAs()` for computed columns like `search_vector`.

**Example (key tables):**

```typescript
// src/lib/db/schema.ts
import {
  pgTable, pgEnum, uuid, text, boolean, integer, serial,
  timestamp, jsonb, index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";

// Custom tsvector type
const tsvector = customType<{ data: string }>({
  dataType() { return "tsvector"; },
});

// Enums
export const roleEnum = pgEnum("role", ["admin", "user"]);
export const changeSourceEnum = pgEnum("change_source", [
  "ai_generated", "ai_updated", "human_edited", "ai_merged",
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "running", "completed", "failed",
]);
export const triggerTypeEnum = pgEnum("trigger_type", [
  "scheduled", "manual",
]);
export const aiConversationModeEnum = pgEnum("ai_conversation_mode", [
  "global", "page",
]);
export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user", "assistant",
]);

// === Auth.js Required Tables ===

export const users = pgTable("users", {
  // Auth.js required columns
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // App-specific columns
  role: roleEnum("role").default("user").notNull(),
  avatarUrl: text("avatar_url"),      // User-uploaded avatar (separate from Google image)
  notifySlackEnabled: boolean("notify_slack_enabled").default(false).notNull(),
  slackUserId: text("slack_user_id"),
  notifyEmailEnabled: boolean("notify_email_enabled").default(false).notNull(),
  notifyOnMention: boolean("notify_on_mention").default(true).notNull(),
  notifyOnActivity: boolean("notify_on_activity").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [
  primaryKey({ columns: [t.provider, t.providerAccountId] }),
]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

// === Application Tables ===

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order"),
  parentCategoryId: uuid("parent_category_id").references((): any => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  technicalViewMarkdown: text("technical_view_markdown"),
  categoryId: uuid("category_id").references(() => categories.id),
  parentArticleId: uuid("parent_article_id").references((): any => articles.id),
  sortOrder: integer("sort_order"),
  lastAiGeneratedAt: timestamp("last_ai_generated_at", { withTimezone: true }),
  lastHumanEditedAt: timestamp("last_human_edited_at", { withTimezone: true }),
  lastHumanEditorId: uuid("last_human_editor_id").references(() => users.id),
  hasHumanEdits: boolean("has_human_edits").default(false).notNull(),
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    (): SQL => sql`to_tsvector('english', coalesce(${articles.title}, '') || ' ' || coalesce(${articles.contentMarkdown}, ''))`
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_articles_search").using("gin", t.searchVector),
  index("idx_articles_category").on(t.categoryId),
  index("idx_articles_parent").on(t.parentArticleId),
]);

// ... remaining tables follow same pattern
// (article_versions, github_files, excluded_paths, article_file_links,
//  article_db_tables, comments, mentions, ai_conversations,
//  ai_conversation_messages, article_images, site_settings, sync_logs)
```

**Source:** [Auth.js Drizzle Adapter](https://authjs.dev/getting-started/adapters/drizzle), [Drizzle PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg), [Drizzle generated columns](https://orm.drizzle.team/docs/generated-columns)

### Pattern 4: First-User-Is-Admin Logic

**What:** The first user to log in via Google OIDC is automatically assigned the `admin` role. All subsequent users get `user` role. This is implemented in the Auth.js sign-in event, not in middleware.

**When to use:** On every new user creation (first sign-in via Google).

**Example:**

```typescript
// In src/lib/auth/index.ts, add events to NextAuth config
export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... adapter, session, callbacks ...
  events: {
    async createUser({ user }) {
      // Check if this is the first user
      const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .limit(1);

      if (existingUsers.length <= 1) {
        // This IS the first user (the one just created) -- make them admin
        await db
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.id, user.id!));
      }
    },
  },
});
```

**Note:** The `createUser` event fires after the adapter creates the user record. At that point, if only 1 user exists in the table (the one just created), that user becomes admin. The JWT will pick up the role on the next sign-in cycle. To ensure the role is immediately available in the session, the `jwt` callback should re-query the user's role from the database on first sign-in.

**Source:** [Auth.js Role-Based Access Control](https://authjs.dev/guides/role-based-access-control)

### Pattern 5: Docker Multi-Stage Build with Standalone Output

**What:** Use Next.js `output: "standalone"` with a multi-stage Dockerfile. The standalone output bundles the server and all dependencies into a minimal folder, eliminating the need for `node_modules` in the final image.

**When to use:** Always for production Docker deployment.

**Example:**

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create image storage directory
RUN mkdir -p /data/images && chown nextjs:nodejs /data/images

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - image_data:/data/images
    env_file:
      - .env
    restart: unless-stopped

volumes:
  image_data:
    driver: local
```

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Source:** [Next.js Docker example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile), [Next.js standalone output docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

### Pattern 6: TypeScript Type Augmentation for Auth.js

**What:** Extend Auth.js types to include the `role` and `id` fields on the session user and JWT token.

**Example:**

```typescript
// src/types/next-auth.d.ts
import "next-auth";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
```

**Source:** [Auth.js Role-Based Access Control](https://authjs.dev/guides/role-based-access-control)

### Anti-Patterns to Avoid

- **Importing the full auth (with adapter) in middleware.ts:** Causes edge runtime build failure. Always import only the edge-safe config in middleware.
- **Using `next-auth@4` (stable) with Next.js 15:** Does not work. Must use `next-auth@beta` (v5).
- **Using `serial` for primary keys:** PostgreSQL best practices in 2025+ recommend identity columns or UUID. The spec uses UUID for all tables, which is correct.
- **Running migrations via the HTTP driver:** The HTTP driver does not support transactions needed for DDL. Use `pg` (node-postgres) with the unpooled connection string for migrations.
- **Defining the schema incrementally phase by phase:** Define ALL tables upfront. Downstream phases depend on foreign keys, and Drizzle migration diffs work best when the full schema is present from the start.
- **Storing only Markdown without planning for BlockNote JSON:** Phase 5 may need a `content_json` column on `articles`. Either add it now or plan for a migration. The existing research recommends dual storage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication + session management | Custom JWT/cookie auth | NextAuth v5 with DrizzleAdapter | OAuth flows, CSRF protection, token rotation, session invalidation are subtle and security-critical. |
| Database migrations | Raw SQL migration scripts | drizzle-kit generate + migrate | Schema diffing, rollback tracking, TypeScript schema as source of truth. |
| Form validation | Manual request body parsing | Zod schemas | Type inference, composable validators, integrates with both client and server. |
| Component primitives | Custom dropdowns, modals, tabs | shadcn/ui (Radix UI primitives) | Accessibility, keyboard navigation, focus management are deceptively complex. |
| CSS utility system | Custom SCSS/CSS modules | Tailwind CSS 4 | Consistent design tokens, purging, responsive utilities. |
| UUID generation | Custom ID generators | `uuid().defaultRandom()` in Drizzle | PostgreSQL `gen_random_uuid()` is cryptographically strong and conflict-free. |

## Common Pitfalls

### Pitfall 1: Auth.js Edge Runtime Crash with Database Adapter

**What goes wrong:** Importing the DrizzleAdapter in middleware causes build failure because the adapter uses `pg` (TCP sockets), which is unavailable in the edge runtime.
**Why it happens:** Next.js middleware runs on edge runtime by default. Auth.js v5 requires different configuration for edge vs Node.js contexts.
**How to avoid:** Use the split config pattern: `auth.config.ts` (edge-safe, no adapter) imported by middleware; `auth.ts` (full config with adapter) imported by server components and API routes.
**Warning signs:** Build error mentioning "Module not found: Can't resolve 'pg'" or "process.version is not available in edge runtime."

### Pitfall 2: Auth.js JWT Session Does Not Include Role on First Sign-In

**What goes wrong:** The first time a user signs in, the `jwt` callback receives the user object from the OAuth provider, not from the database. The `role` field is not yet set because the adapter's `createUser` event hasn't fired or the role hasn't been queried.
**Why it happens:** Auth.js callback execution order: `signIn` -> `createUser` event (adapter) -> `jwt` callback. The JWT callback may fire before the role is set by the `createUser` event.
**How to avoid:** In the `jwt` callback, if `user` exists (new sign-in), query the database for the user's current role. Do not rely solely on the `user` object passed to the callback.
**Warning signs:** New users see "user" role even after being the first user (should be admin). Role appears correct only after signing out and signing back in.

### Pitfall 3: Drizzle Migration Fails on Neon Pooled Connection

**What goes wrong:** Running `drizzle-kit migrate` with the pooled (PgBouncer) connection string fails with transaction or prepared statement errors.
**Why it happens:** Neon's pooled endpoint uses PgBouncer in transaction mode, which does not support `SET` commands, prepared statements across transactions, or DDL within transactions reliably.
**How to avoid:** Always use `DATABASE_URL_UNPOOLED` (the direct, non-pooler endpoint) for migrations and any operation that requires session-level features.
**Warning signs:** Errors like "prepared statement does not exist" or "cannot execute CREATE TABLE in a read-only transaction."

### Pitfall 4: Generated tsvector Column Blocks INSERT/UPDATE on Empty Table

**What goes wrong:** The `generatedAlwaysAs` tsvector column may cause issues if the `to_tsvector()` function receives NULL or empty values during initial data seeding.
**Why it happens:** PostgreSQL's `to_tsvector()` with NULL input returns NULL, which is fine. But if the generated column expression references columns that don't exist yet in the INSERT statement, it can error.
**How to avoid:** Use `COALESCE` in the generated expression to handle NULLs: `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_markdown, ''))`. This is already shown in the schema example above.
**Warning signs:** INSERT operations on `articles` table fail with "cannot insert into a generated column" or tsvector parse errors.

### Pitfall 5: Docker Volume Permissions on /data/images

**What goes wrong:** The Next.js process (running as non-root user `nextjs`) cannot write to `/data/images` because the volume mount creates the directory owned by root.
**Why it happens:** Docker named volumes are created with root ownership by default. The Dockerfile creates the directory and sets ownership, but a named volume mount overrides the directory.
**How to avoid:** In the Dockerfile, create the `/data/images` directory and chown it BEFORE the `USER nextjs` directive. Additionally, in docker-compose, ensure the volume is correctly mapped. If needed, use an init container or entrypoint script to fix permissions.
**Warning signs:** Image uploads fail with EACCES errors. No images saved to disk.

### Pitfall 6: Forgetting to Seed site_settings Keys

**What goes wrong:** The application starts but admin pages crash because they try to read `site_settings` keys that don't exist.
**Why it happens:** The `site_settings` table is a key-value store. The application expects specific keys to exist (e.g., `sync_cron_schedule`, `openrouter_api_key`). Without seeding, these are absent.
**How to avoid:** Create a `seed.ts` script that inserts all required `site_settings` keys with default/empty values. Run it as part of the initial deployment. Add a migration or startup check that ensures required keys exist.
**Warning signs:** Admin settings page shows errors or blank fields. API routes return "setting not found."

## Code Examples

### Drizzle Config File

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
```

### Route Handler for Auth

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

### Server Component Auth Check

```typescript
// src/app/(wiki)/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

### Admin Role Check in Server Action

```typescript
// src/app/(admin)/users/actions.ts
"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function promoteUser(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function demoteUser(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  // Prevent self-demotion
  if (userId === session.user.id) {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users)
    .set({ role: "user", updatedAt: new Date() })
    .where(eq(users.id, userId));
}
```

### User Profile Update

```typescript
// src/app/(wiki)/profile/actions.ts
"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = formData.get("name") as string;

  await db.update(users)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));
}

export async function updateNotificationPreferences(data: {
  notifySlackEnabled: boolean;
  slackUserId: string | null;
  notifyEmailEnabled: boolean;
  notifyOnMention: boolean;
  notifyOnActivity: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));
}
```

### Seed Script for site_settings

```typescript
// src/lib/db/seed.ts
import { db } from "./index";
import { siteSettings } from "./schema";

const requiredSettings = [
  { key: "github_repo_url", description: "Full GitHub repository URL" },
  { key: "github_api_key", description: "GitHub Personal Access Token" },
  { key: "openrouter_api_key", description: "OpenRouter API key" },
  { key: "openrouter_model", description: "OpenRouter model name", value: "anthropic/claude-sonnet-4-20250514" },
  { key: "sync_cron_schedule", description: "Cron expression for scheduled sync", value: "0 9 * * 6" },
  { key: "sendgrid_api_key", description: "SendGrid API key" },
  { key: "sendgrid_from_email", description: "SendGrid sender email address" },
  { key: "slack_bot_token", description: "Slack Bot OAuth token" },
  { key: "analysis_prompt", description: "AI code analysis prompt" },
  { key: "article_style_prompt", description: "AI article writing style prompt" },
  { key: "ask_ai_global_prompt", description: "Global Ask AI system prompt" },
  { key: "ask_ai_page_prompt", description: "Page-level Ask AI system prompt" },
];

async function seed() {
  for (const setting of requiredSettings) {
    await db.insert(siteSettings)
      .values({
        key: setting.key,
        value: setting.value ?? "",
        description: setting.description,
      })
      .onConflictDoNothing({ target: siteSettings.key });
  }
  console.log("Seeded site_settings");
}

seed();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth@4` (stable) | `next-auth@beta` (v5 / Auth.js) | 2024+ | v4 does not support App Router properly. v5 is the only option for Next.js 15+. |
| `serial` PKs | UUID with `defaultRandom()` | 2025 PostgreSQL best practices | PostgreSQL community recommends identity columns or UUID over serial. Drizzle supports both. |
| Tailwind v3 (`tailwind.config.ts`) | Tailwind v4 (CSS-first config) | Jan 2025 | New engine, no JS config file. shadcn/ui fully supports v4. |
| Multiple `@radix-ui/react-*` packages | Single `radix-ui` package | Jan 2026 | shadcn/ui unified to single Radix import. |
| `drizzle-kit push` for production | `drizzle-kit generate` + `migrate` for production | Best practice 2025 | `push` is for rapid prototyping. `generate` + `migrate` provides auditable migration files. |
| `node:20-alpine` Docker base | `node:22-alpine` Docker base | 2025 | pg-boss 12.x requires Node 22.12+. |

## Open Questions

1. **Should `content_json` column be added to `articles` table now?**
   - What we know: BlockNote's Markdown export is lossy. The prior research recommends dual storage (JSON + Markdown).
   - What's unclear: Whether the lossy conversion is acceptable for this project's content types (mostly prose with headings, lists, code blocks, tables).
   - Recommendation: Add the column now (nullable `jsonb`). It costs nothing if unused and avoids a migration later. Phase 5 will validate if it is needed.

2. **Should site_settings secrets be encrypted at rest?**
   - What we know: The spec says "DB connection is TLS-encrypted" but doesn't mention encryption at rest. The pitfalls research recommends AES-256-GCM encryption.
   - What's unclear: Whether the threat model for a private-server, single-tenant app warrants the complexity.
   - Recommendation: Defer encryption to Phase 2 (admin settings). For Phase 1, just create the table with a placeholder `is_secret` boolean column. Implement encryption when the admin settings UI is built and secrets are actually stored.

3. **Should all 14+ tables be defined in Phase 1, or only the ones needed immediately?**
   - What we know: Drizzle migration diffs work best with the full schema present. Foreign key references across tables require all tables to exist.
   - Recommendation: Define ALL tables in Phase 1 schema.ts. This produces a single clean initial migration. Subsequent phases only modify existing tables, never create new ones from scratch.

## Sources

### Primary (HIGH confidence)
- [Auth.js Drizzle Adapter docs](https://authjs.dev/getting-started/adapters/drizzle) -- adapter setup, custom table mapping
- [Auth.js Edge Compatibility Guide](https://authjs.dev/guides/edge-compatibility) -- split config pattern
- [Auth.js Role-Based Access Control](https://authjs.dev/guides/role-based-access-control) -- JWT/session callbacks for role
- [Auth.js Next.js Reference](https://authjs.dev/reference/nextjs) -- handlers, auth(), middleware setup
- [Auth.js Drizzle Adapter PostgreSQL Reference](https://authjs.dev/reference/drizzle-adapter/lib/pg) -- column definitions for Auth tables
- [Drizzle ORM + Neon tutorial](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon) -- HTTP driver setup, migration commands
- [Drizzle ORM PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg) -- uuid, pgEnum, text, boolean, timestamp, jsonb, customType
- [Drizzle ORM generated columns](https://orm.drizzle.team/docs/generated-columns) -- `generatedAlwaysAs` for tsvector
- [Drizzle ORM Neon connection patterns](https://orm.drizzle.team/docs/connect-neon) -- HTTP, WebSocket, node-postgres drivers
- [Next.js Docker example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile) -- official multi-stage Dockerfile
- [Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation) -- `register()` hook, NEXT_RUNTIME check
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) -- Docker-optimized build
- [Neon connection types](https://neon.com/docs/connect/choose-connection) -- pooled vs direct connection strings

### Secondary (MEDIUM confidence)
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) -- init with Tailwind v4
- [Drizzle ORM PostgreSQL Best Practices 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) -- identity columns, schema organization
- [Auth.js migration guide v4 to v5](https://authjs.dev/getting-started/migrating-to-v5) -- breaking changes, new patterns

### Tertiary (LOW confidence)
- [Community blog: Auth.js v5 + Drizzle + Next.js](https://reetesh.in/blog/authentication-using-auth.js-v5-and-drizzle-for-next.js-app-router) -- practical setup walkthrough
- [Next.js GitHub discussion #16995](https://github.com/vercel/next.js/discussions/16995) -- Docker best practices community discussion

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified via official docs, versions confirmed
- Architecture (split auth, dual DB): HIGH -- patterns from official Auth.js and Drizzle docs
- Schema design: HIGH -- column types verified via Drizzle docs, Auth.js adapter requirements confirmed
- Docker setup: HIGH -- official Next.js example Dockerfile with well-known patterns
- Pitfalls: HIGH -- edge runtime crash and migration issues are well-documented

**Research date:** 2026-02-13
**Valid until:** 60 days (stable technologies, no fast-moving changes expected)
