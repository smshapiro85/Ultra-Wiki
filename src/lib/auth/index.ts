import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { authConfig } from "./config";

// Use NextAuth lazy initialization so the DrizzleAdapter receives
// a real db instance at request time, not at module-evaluation time
// (which fails during static page collection in `next build`).
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();

  return {
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
      async jwt({ token, user }) {
        // On first sign-in (user object present), query the DB for the
        // current role. This handles the race condition where createUser
        // event may have just promoted the first user to admin.
        if (user?.id) {
          const [dbUser] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
          token.id = user.id;
          token.role = dbUser?.role ?? "user";
        }
        return token;
      },
      async session({ session, token }) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        if (token.role) {
          session.user.role = token.role as string;
        }
        return session;
      },
    },
    events: {
      async createUser({ user }) {
        // First-user-is-admin: if this is the only user, promote to admin
        if (!user.id) return;
        const [{ value: userCount }] = await db
          .select({ value: count() })
          .from(users);
        if (userCount <= 1) {
          await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, user.id));
        }
      },
    },
  };
});
