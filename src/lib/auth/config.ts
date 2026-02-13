import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      // Always allow access to the login page
      if (pathname.startsWith("/login")) {
        return true;
      }

      // Redirect unauthenticated users to login
      if (!auth) {
        return false;
      }

      return true;
    },
    jwt({ token, user }) {
      // On sign-in, persist role and id from the user object to the token
      if (user) {
        token.role = user.role ?? "user";
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
