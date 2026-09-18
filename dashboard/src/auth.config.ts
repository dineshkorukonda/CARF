import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubId?: string | null;
    };
  }

  interface User {
    githubId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    providerAccountId?: string;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/api/auth");
      const isPublicAsset =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/static") ||
        nextUrl.pathname.endsWith(".ico") ||
        nextUrl.pathname.endsWith(".png") ||
        nextUrl.pathname.endsWith(".svg");

      if (isAuthRoute || isPublicAsset) {
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token?.sub) {
          session.user.id = token.sub;
        }
        if (token?.providerAccountId) {
          session.user.githubId = token.providerAccountId;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.providerAccountId) {
        token.providerAccountId = account.providerAccountId;
      }
      return token;
    },
  },
};

